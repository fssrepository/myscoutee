import { Injectable, computed, inject, signal } from '@angular/core';
import type { ChatDTO } from '../../contracts/chat.interface';
import type { ChatCallEvent, ChatCallParticipant, ChatCallStunNode } from '../../contracts/chat-call.interface';
import { ChatsService } from './chats.service';
import { ChatCallMls, type CallMlsCommit } from './chat-call-mls';
import { ChatCallVoiceActivity } from './chat-call-voice-activity';

export interface ChatCallRemote {
  id: string;
  userId: string;
  name: string;
  video: boolean;
  stream: MediaStream;
  state: 'connecting' | 'connected' | 'failed';
}
interface Peer {
  pc: RTCPeerConnection;
  stream: MediaStream;
  incomingIce: RTCIceCandidateInit[];
  outgoingIce: RTCIceCandidateInit[];
  ready: boolean;
  sendVideoEnabled: boolean;
  sends: Promise<void>;
  timer: ReturnType<typeof setTimeout>;
}
interface SecureSignal {
  chatId: string;
  callId: string;
  senderSessionId: string;
  targetSessionId: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  camera?: boolean;
  receiveVideo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatCallService {
  private readonly chats = inject(ChatsService);
  readonly open = signal(false);
  readonly available = signal(false);
  readonly cameraPending = signal(false);
  readonly status = signal<'idle' | 'incoming' | 'preparing' | 'waiting' | 'connecting' | 'active'>('idle');
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly nodes = signal<ChatCallStunNode[]>([]);
  readonly selectedNode = signal('');
  readonly localStream = signal<MediaStream | null>(null);
  readonly remotes = signal<ChatCallRemote[]>([]);
  readonly participants = signal<ChatCallParticipant[]>([]);
  readonly adminMuted = signal(false);
  readonly activeSpeakers = signal<ReadonlySet<string>>(new Set());
  readonly audioLevels = signal<Readonly<Partial<Record<string, readonly number[]>>>>({});
  readonly canModerate = computed(() => this.participants().some(p => this.isSelf(p.sessionId) && p.moderator));
  readonly tiles = computed(() => this.participants().filter(p => !this.isSelf(p.sessionId)).map(p => {
    const remote = this.remotes().find(remote => remote.id === p.sessionId);
    return { id: p.sessionId, name: this.chat?.members?.find(member => member.id === p.userId)?.name ?? '',
      stream: remote?.stream ?? null, cameraOn: remote?.video ?? false, video: (remote?.video ?? false) && this.receivesVideo(p.sessionId), state: remote?.state ?? 'connecting', mutedByAdmin: p.mutedByAdmin };
  }));
  readonly coordinator = signal('');
  readonly verificationCode = signal('');
  readonly muted = signal(false);
  readonly speakerMuted = signal(false);
  readonly volume = signal(100);
  readonly peerVolumes = signal<Readonly<Partial<Record<string, number>>>>({});
  readonly peerMuted = signal<Readonly<Partial<Record<string, boolean>>>>({});
  readonly peerReceiveVideo = signal<Readonly<Partial<Record<string, boolean>>>>({});
  private readonly visibleVideoPeers = signal<ReadonlySet<string>>(new Set());
  readonly cameraOff = signal(false);
  readonly title = signal('');
  private chat: ChatDTO | null = null;
  private selfId = '';
  private callId = '';
  private invite: Extract<ChatCallEvent, { kind: 'invite' }> | null = null;
  private mls: ChatCallMls | null = null;
  private readonly peers = new Map<string, Peer>();
  private unwatch: (() => void) | null = null;
  private binding = 0;
  private generation = 0;
  private events: Promise<void> = Promise.resolve();
  private epoch = 0;
  private readonly knownClients = new Set<string>();
  private pendingCommit: { resolve: () => void; reject: () => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
  private voice: ChatCallVoiceActivity | null = null;

  supported(): boolean { return this.chats.chatCallsSupported(); }

  async bindChat(chat: ChatDTO | null): Promise<void> {
    const binding = ++this.binding;
    await this.hangUp();
    if (binding !== this.binding) return;
    this.unwatch?.(); this.unwatch = null;
    this.chat = chat; this.invite = null; this.open.set(false); this.error.set(null);
    this.available.set(false); this.nodes.set([]); this.selectedNode.set(''); this.title.set(chat?.title ?? '');
    if (!chat || !this.supported()) return;
    const unwatch = await this.chats.watchChatEvents(chat, event => {
      if (event.chatId !== chat.id || binding !== this.binding) return;
      if (event.type === 'disconnected') {
        this.available.set(false); this.reset(); this.invite = null; this.error.set('chat.call.error.signaling');
      } else if (event.type === 'reconnected') {
        void this.chats.sendChatCall(chat, { action: 'configuration' }).catch(() => this.error.set('chat.call.error.signaling'));
      } else if (event.type === 'call') {
        // A transport acknowledgement must bypass the crypto event queue it releases.
        if (event.call.kind === 'committed' && event.call.callId === this.callId && this.pendingCommit) {
          if (event.call.epoch !== this.epoch + 1) { this.pendingCommit.reject(); return; }
          this.epoch = event.call.epoch; this.pendingCommit.resolve(); return;
        }
        if (event.call.kind === 'error' && this.pendingCommit) this.pendingCommit.reject();
        const generation = this.generation;
        this.events = this.events.then(async () => {
          if (binding === this.binding && (generation === this.generation || ['configuration', 'availability', 'invite'].includes(event.call.kind))) {
            await this.receive(event.call);
          }
        }).catch(async () => {
          if (binding === this.binding && generation === this.generation) await this.failJoin('chat.call.error.secure');
        });
      }
    });
    if (binding !== this.binding) { unwatch(); return; }
    this.unwatch = unwatch;
    try { await this.chats.sendChatCall(chat, { action: 'configuration' }); }
    catch { if (binding === this.binding) this.error.set('chat.call.error.signaling'); }
  }

  show(): void { this.open.set(true); if (this.status() === 'idle') void this.join(false); }
  async close(): Promise<void> { await this.hangUp(); this.open.set(false); }
  decline(): void {
    if (this.chat && this.invite) void this.chats.sendChatCall(this.chat,
      { action: 'decline', callId: this.invite.callId }).catch(() => {});
    this.status.set('idle'); this.open.set(false);
  }

  async join(video: boolean): Promise<void> {
    const chat = this.chat;
    if (!chat || !this.available() || !['idle', 'incoming'].includes(this.status())) return;
    if (!window.isSecureContext || typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.error.set('chat.call.error.browser'); return;
    }
    const nodeId = this.invite?.nodeId ?? this.selectedNode();
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node || !node.urls.every(url => /^stuns?:/.test(url))) { this.error.set('chat.call.error.node'); return; }
    const generation = ++this.generation;
    const callId = this.invite?.callId ?? crypto.randomUUID();
    this.error.set(null); this.notice.set(null); this.status.set('preparing'); this.open.set(true);
    let mls: ChatCallMls | null = null;
    let stream: MediaStream | null = null;
    try {
      mls = await ChatCallMls.create(callId, bundle => this.sendCommit(bundle));
      if (generation !== this.generation) { void mls.destroy(); return; }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
        video: video ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } } : false });
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); void mls.destroy(); return; }
      this.mls = mls; this.localStream.set(stream); this.callId = callId;
      this.selectedNode.set(nodeId); this.cameraOff.set(!video); this.muted.set(false);
      this.speakerMuted.set(false);
      this.voice = new ChatCallVoiceActivity(speakers => this.activeSpeakers.set(speakers), levels => this.audioLevels.set(levels));
      const local = stream;
      this.voice.watch('self', local, () => !this.muted() && !this.adminMuted() && local.getAudioTracks().some(t => t.enabled && !t.muted && t.readyState === 'live'));
      this.status.set('waiting');
      this.joinTimer = setTimeout(() => { void this.failJoin('chat.call.error.signaling'); }, 20_000);
      await this.chats.sendChatCall(chat, { action: 'join', callId, bundle: mls.bundle(), clientId: mls.clientId, video, nodeId });
    } catch (error) {
      stream?.getTracks().forEach(t => t.stop()); void mls?.destroy();
      if (generation !== this.generation) return;
      await this.failJoin(error instanceof DOMException && ['NotAllowedError', 'NotFoundError', 'NotReadableError'].includes(error.name)
        ? 'chat.call.error.media' : 'chat.call.error.signaling');
    }
  }

  async hangUp(): Promise<void> {
    const chat = this.chat, callId = this.callId;
    if (callId && this.selfId) this.invite = { kind: 'invite', callId, video: false, nodeId: this.selectedNode() };
    this.reset();
    if (chat && callId) {
      try { await this.chats.sendChatCall(chat, { action: 'leave', callId }); }
      catch { /* Local media is already stopped, including when the signaling socket is lost. */ }
    }
  }
  toggleMute(): void {
    if (this.adminMuted()) return;
    this.muted.update(value => !value);
    this.localStream()?.getAudioTracks().forEach(track => { track.enabled = !this.muted(); });
  }
  isSelf(id: string): boolean { return !!this.selfId && this.selfId === id; }
  resumeAudio(): void { this.voice?.resume(); }
  setVolume(value: number, id?: string): void {
    if (!Number.isFinite(value)) return;
    value = Math.min(100, Math.max(0, value));
    if (id) this.peerVolumes.update(volumes => ({ ...volumes, [id]: value })); else this.volume.set(value);
  }
  playbackVolume(id: string): number { return this.volume() * (this.peerVolumes()[id] ?? 100) / 10_000; }
  togglePeerMute(id: string): void { this.peerMuted.update(values => ({ ...values, [id]: !values[id] })); }
  allowsVideo(id: string): boolean { return this.peerReceiveVideo()[id] !== false; }
  receivesVideo(id: string): boolean { return this.allowsVideo(id) && this.visibleVideoPeers().has(id); }
  async toggleReceivingVideo(id: string): Promise<void> {
    this.peerReceiveVideo.update(values => ({ ...values, [id]: values[id] === false }));
    await this.sendVideoPreference(id);
  }
  async setVisibleVideoPeers(ids: readonly string[]): Promise<void> {
    const previous = this.visibleVideoPeers(), next = new Set(ids);
    if (previous.size === next.size && [...next].every(id => previous.has(id))) return;
    this.visibleVideoPeers.set(next);
    await Promise.all([...this.peers.keys()].filter(id => this.allowsVideo(id) && previous.has(id) !== next.has(id))
      .map(id => this.sendVideoPreference(id)));
  }
  private async sendVideoPreference(id: string): Promise<void> {
    const peer = this.peers.get(id);
    if (!peer || peer.pc.connectionState === 'closed') return;
    try { await this.send(id, { receiveVideo: this.receivesVideo(id) }); }
    catch { this.failPeer(id, 'chat.call.error.signaling'); }
  }
  async moderate(id: string, muted: boolean): Promise<void> {
    if (!this.chat || !this.callId || !this.canModerate()) return;
    try { await this.chats.sendChatCall(this.chat, { action: 'mute', callId: this.callId, targetSessionId: id, muted }); }
    catch { this.error.set('chat.call.error.signaling'); }
  }
  async toggleCamera(): Promise<void> {
    const stream = this.localStream(), generation = this.generation;
    if (!stream || this.cameraPending()) return;
    this.cameraPending.set(true);
    try {
      let track = stream.getVideoTracks()[0];
      if (!track) {
        const media = await navigator.mediaDevices.getUserMedia({ audio: false,
          video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } } });
        if (generation !== this.generation) { media.getTracks().forEach(t => t.stop()); return; }
        track = media.getVideoTracks()[0]; stream.addTrack(track);
        for (const peer of this.peers.values()) {
          const sender = peer.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender;
          if (sender) await sender.replaceTrack(peer.sendVideoEnabled ? track : null);
        }
        if (generation !== this.generation) return;
        this.cameraOff.set(false); this.localStream.set(new MediaStream(stream.getTracks()));
      } else {
        for (const peer of this.peers.values()) {
          const sender = peer.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender;
          if (sender) await sender.replaceTrack(null);
        }
        track.stop(); stream.removeTrack(track);
        if (generation !== this.generation) return;
        this.cameraOff.set(true); this.localStream.set(new MediaStream(stream.getTracks()));
      }
      await Promise.all([...this.peers.keys()].map(id => this.send(id, { camera: !this.cameraOff() })));
    } catch { if (generation === this.generation) this.error.set('chat.call.error.media'); }
    finally { if (generation === this.generation) this.cameraPending.set(false); }
  }
  private reset(): void {
    ++this.generation;
    this.pendingCommit?.reject(); this.epoch = 0; this.knownClients.clear(); this.cameraPending.set(false); this.cameraOff.set(true);
    if (this.joinTimer) clearTimeout(this.joinTimer);
    this.joinTimer = null;
    this.localStream()?.getTracks().forEach(track => track.stop()); this.localStream.set(null);
    this.voice?.destroy(); this.voice = null; this.adminMuted.set(false);
    this.peerVolumes.set({}); this.peerMuted.set({}); this.volume.set(100);
    this.visibleVideoPeers.set(new Set()); this.peerReceiveVideo.set({});
    for (const peer of this.peers.values()) { clearTimeout(peer.timer); peer.pc.close(); }
    this.peers.clear(); void this.mls?.destroy(); this.mls = null;
    this.callId = ''; this.selfId = ''; this.remotes.set([]); this.participants.set([]);
    this.coordinator.set(''); this.verificationCode.set(''); this.status.set('idle');
    this.notice.set(null);
  }
  private async failJoin(error: string): Promise<void> { await this.hangUp(); this.error.set(error); }

  private async receive(event: ChatCallEvent): Promise<void> {
    if (event.kind === 'availability') { this.available.set(event.available); return; }
    if (event.kind === 'configuration') {
      this.available.set(event.available);
      this.nodes.set(event.nodes.filter(node => node.urls.every(url => /^stuns?:/.test(url))));
      if (!this.selectedNode()) this.selectedNode.set(this.nodes().find(node => node.urls.length)?.id ?? 'direct');
      return;
    }
    if (event.kind === 'committed') return;
    if (event.kind === 'invite') {
      if (!this.callId && !this.invite && this.status() === 'idle') {
        this.invite = event; this.status.set('incoming'); this.selectedNode.set(event.nodeId); this.open.set(true);
      }
      return;
    }
    if (event.kind === 'error') { if (this.callId) await this.failJoin('chat.call.error.signaling'); return; }
    if (event.kind === 'ended') {
      if (this.invite?.callId === event.callId) { this.invite = null; this.status.set('idle'); }
      if (this.callId === event.callId) this.reset();
      return;
    }
    if (!this.callId || event.callId !== this.callId || !this.mls) return;
    if (event.kind === 'declined') { this.notice.set('chat.call.notice.declined'); return; }
    if (event.kind === 'roster') {
      if (this.joinTimer) clearTimeout(this.joinTimer); this.joinTimer = null;
      this.invite = null; this.selfId = event.selfSessionId;
      const previous = this.participants();
      for (const participant of event.participants) {
        const known = previous.find(p => p.sessionId === participant.sessionId);
        if (known && (known.bundle !== participant.bundle || known.clientId !== participant.clientId)) { await this.failJoin('chat.call.error.secure'); return; }
      }
      this.participants.set(event.participants);
      const forced = event.participants.find(p => this.isSelf(p.sessionId))?.mutedByAdmin ?? false;
      this.adminMuted.set(forced);
      if (forced) {
        this.muted.set(true); this.localStream()?.getAudioTracks().forEach(track => { track.enabled = false; });
      }
      // Ordered membership elects the oldest surviving participant as coordinator.
      this.coordinator.set(event.participants[0]?.sessionId ?? '');
      for (const id of this.peers.keys()) {
        if (!event.participants.some(p => p.sessionId === id)) this.removePeer(id);
      }
      for (const participant of event.participants) this.knownClients.add(participant.clientId);
      this.epoch = Math.max(this.epoch, event.epoch);
      if (this.isSelfCoordinator()) await this.mls.reconcile(event.participants);
      await this.startPeers(); return;
    }
    if (event.kind === 'mls') {
      if (event.epoch !== this.epoch + 1 || event.senderSessionId !== this.coordinator()) throw new Error('Unordered MLS commit.');
      const bundle = JSON.parse(event.data) as CallMlsCommit;
      if (!Array.isArray(bundle.members) || bundle.members.some(id => !this.knownClients.has(id))) throw new Error('Unknown MLS member.');
      if (bundle.members.includes(this.mls.clientId)) await this.mls.accept(bundle);
      else if (await this.mls.exists()) throw new Error('MLS removed an active room member.');
      this.epoch = event.epoch;
      await this.startPeers(); return;
    }
    if (event.kind === 'signal') {
      const participant = this.participants().find(p => p.sessionId === event.senderSessionId);
      if (!participant || !await this.mls.exists()) return;
      try {
        const generation = this.generation;
        const { clientId, plaintext } = await this.mls.decrypt(event.data);
        if (clientId !== participant.clientId) throw new Error('MLS sender identity mismatch.');
        if (generation !== this.generation) return;
        const payload = JSON.parse(plaintext) as SecureSignal;
        if (payload.callId !== this.callId || payload.chatId !== this.chat?.id
            || payload.senderSessionId !== event.senderSessionId) {
          throw new Error('Call context mismatch.');
        }
        if (payload.targetSessionId !== this.selfId) return;
        const peer = this.peers.get(event.senderSessionId);
        if (!peer || peer.pc.connectionState === 'closed') return;
        if (typeof payload.receiveVideo === 'boolean') {
          peer.sendVideoEnabled = payload.receiveVideo;
          const sender = peer.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender;
          if (sender) await sender.replaceTrack(peer.sendVideoEnabled && !this.cameraOff()
            ? this.localStream()?.getVideoTracks()[0] ?? null : null);
        } else if (typeof payload.camera === 'boolean') {
          this.remotes.update(items => items.map(item => item.id === event.senderSessionId ? { ...item, video: payload.camera! } : item));
        } else if (payload.description) {
          if (!['offer', 'answer'].includes(payload.description.type) || /a=candidate:.* typ relay(?:\s|$)/m.test(payload.description.sdp ?? '')) {
            throw new Error('Invalid direct call description.');
          }
          await peer.pc.setRemoteDescription(payload.description);
          for (const candidate of peer.incomingIce.splice(0)) await peer.pc.addIceCandidate(candidate);
          if (payload.description.type === 'offer') {
            await peer.pc.setLocalDescription(await peer.pc.createAnswer());
            if (generation !== this.generation) return;
            await this.sendDescription(event.senderSessionId, peer);
          }
        } else if (payload.candidate) {
          if (!this.directCandidate(payload.candidate)) throw new Error('Relay candidates are forbidden.');
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(payload.candidate);
          else if (peer.incomingIce.length < 256) peer.incomingIce.push(payload.candidate);
          else throw new Error('Too many candidates.');
        } else throw new Error('Invalid call signal.');
      } catch { this.failPeer(event.senderSessionId, 'chat.call.error.secure'); }
    }
  }

  private async sendCommit(bundle: CallMlsCommit): Promise<void> {
    const chat = this.chat, callId = this.callId;
    if (!chat || !callId || !this.isSelfCoordinator() || this.pendingCommit) throw new Error('MLS coordinator required.');
    await new Promise<void>((resolve, reject) => {
      const finish = (success: boolean) => {
        if (!this.pendingCommit) return;
        clearTimeout(this.pendingCommit.timer); this.pendingCommit = null;
        if (success) resolve(); else reject(new Error('MLS commit was not accepted.'));
      };
      this.pendingCommit = { resolve: () => finish(true), reject: () => finish(false),
        timer: setTimeout(() => finish(false), 10_000) };
      void this.chats.sendChatCall(chat, { action: 'commit', callId, epoch: this.epoch, data: JSON.stringify(bundle) })
        .catch(() => finish(false));
    });
  }
  private async startPeers(): Promise<void> {
    const mls = this.mls, generation = this.generation;
    if (!mls || !await mls.exists()) return;
    const current = (await mls.memberIds()).sort(), desired = this.participants().map(p => p.clientId).sort();
    if (JSON.stringify(current) !== JSON.stringify(desired)) { this.verificationCode.set(''); return; }
    const code = await mls.verificationCode();
    if (generation !== this.generation) return;
    this.verificationCode.set(code);
    for (const participant of this.participants()) {
      if (participant.sessionId === this.selfId || this.peers.has(participant.sessionId)) continue;
      const peer = this.createPeer(participant);
      if (this.selfId < participant.sessionId) {
        await peer.pc.setLocalDescription(await peer.pc.createOffer());
        if (generation !== this.generation) return;
        await this.sendDescription(participant.sessionId, peer);
      }
    }
    this.updateStatus();
  }
  private createPeer(participant: ChatCallParticipant): Peer {
    const node = this.nodes().find(node => node.id === this.selectedNode());
    if (!node || !node.urls.every(url => /^stuns?:/.test(url))) throw new Error('STUN node unavailable.');
    const pc = new RTCPeerConnection({ iceServers: node.urls.length ? [{ urls: node.urls }] : [], iceTransportPolicy: 'all' });
    const stream = new MediaStream();
    const peer: Peer = { pc, stream, incomingIce: [], outgoingIce: [], ready: false, sendVideoEnabled: true, sends: Promise.resolve(),
      timer: setTimeout(() => this.failPeer(participant.sessionId, 'chat.call.error.direct'), 30_000) };
    this.peers.set(participant.sessionId, peer);
    const member = this.chat?.members?.find(member => member.id === participant.userId);
    this.remotes.update(items => [...items, { id: participant.sessionId, userId: participant.userId,
      name: member?.name ?? '', video: participant.video, stream, state: 'connecting' }]);
    for (const kind of ['audio', 'video'] as const) {
      const track = this.localStream()?.getTracks().find(track => track.kind === kind);
      pc.addTransceiver(track ?? kind, { direction: 'sendrecv' });
    }
    pc.ontrack = event => {
      stream.addTrack(event.track); this.remotes.update(items => [...items]);
      if (event.track.kind === 'audio') this.voice?.watch(participant.sessionId, stream,
        () => !event.track.muted && event.track.readyState === 'live'
          && !this.participants().find(p => p.sessionId === participant.sessionId)?.mutedByAdmin);
    };
    pc.onicecandidate = event => {
      if (!event.candidate || !this.directCandidate(event.candidate.toJSON())) return;
      const candidate = event.candidate.toJSON();
      if (!peer.ready) peer.outgoingIce.push(candidate);
      else void this.send(participant.sessionId, { candidate }).catch(() => this.failPeer(participant.sessionId, 'chat.call.error.signaling'));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        clearTimeout(peer.timer);
        void this.verifyRoute(participant.sessionId, peer);
      } else if (pc.connectionState === 'failed') this.failPeer(participant.sessionId, 'chat.call.error.direct');
      else if (pc.connectionState === 'disconnected') {
        this.setPeerState(participant.sessionId, 'connecting');
        clearTimeout(peer.timer);
        peer.timer = setTimeout(() => this.failPeer(participant.sessionId, 'chat.call.error.direct'), 15_000);
      }
    };
    return peer;
  }
  private directCandidate(candidate: RTCIceCandidateInit): boolean {
    return / typ (host|srflx|prflx)(?:\s|$)/.test(candidate.candidate ?? '');
  }
  private async sendDescription(id: string, peer: Peer): Promise<void> {
    const description = peer.pc.localDescription;
    if (!description) throw new Error('No call description.');
    await this.send(id, { receiveVideo: this.receivesVideo(id) });
    await this.send(id, { description: { type: description.type, sdp: description.sdp } });
    await this.send(id, { camera: !this.cameraOff() });
    peer.ready = true;
    for (const candidate of peer.outgoingIce.splice(0)) await this.send(id, { candidate });
  }
  private send(id: string, message: Partial<SecureSignal>): Promise<void> {
    const peer = this.peers.get(id), chat = this.chat, callId = this.callId, mls = this.mls, self = this.selfId;
    if (!peer || !chat || !mls || !callId) return Promise.reject(new Error('Call ended.'));
    peer.sends = peer.sends.then(async () => {
      if (this.callId !== callId || this.peers.get(id) !== peer) return;
      const data = await mls.encrypt({ ...message, chatId: chat.id, callId, senderSessionId: self, targetSessionId: id });
      await this.chats.sendChatCall(chat, { action: 'signal', callId, targetSessionId: id, data });
    });
    return peer.sends;
  }
  private async verifyRoute(id: string, peer: Peer): Promise<void> {
    try {
      const stats = await peer.pc.getStats();
      let selected = '';
      stats.forEach(stat => { if (stat.type === 'transport') selected = stat.selectedCandidatePairId ?? selected; });
      const pair = stats.get(selected);
      if (!pair || stats.get(pair.localCandidateId)?.candidateType === 'relay'
          || stats.get(pair.remoteCandidateId)?.candidateType === 'relay') throw new Error('Unexpected media route.');
      if (this.peers.get(id) === peer) this.setPeerState(id, 'connected');
    } catch { this.failPeer(id, 'chat.call.error.direct'); }
  }
  private setPeerState(id: string, state: ChatCallRemote['state']): void {
    this.remotes.update(items => items.map(item => item.id === id ? { ...item, state } : item)); this.updateStatus();
  }
  private failPeer(id: string, error: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    clearTimeout(peer.timer); peer.pc.close(); this.error.set(error); this.setPeerState(id, 'failed');
    this.voice?.remove(id);
  }
  private removePeer(id: string): void {
    const peer = this.peers.get(id);
    if (peer) { clearTimeout(peer.timer); peer.pc.close(); this.peers.delete(id);  }
    this.remotes.update(items => items.filter(item => item.id !== id));
    this.voice?.remove(id);
    this.peerVolumes.update(volumes => { const next = { ...volumes }; delete next[id]; return next; });
    this.peerMuted.update(values => { const next = { ...values }; delete next[id]; return next; });
    this.peerReceiveVideo.update(values => { const next = { ...values }; delete next[id]; return next; });
  }
  private updateStatus(): void {
    if (!this.callId) return;
    this.status.set(this.remotes().some(peer => peer.state === 'connected') ? 'active'
      : this.remotes().some(peer => peer.state === 'connecting') ? 'connecting' : 'waiting');
  }
  isSelfCoordinator(): boolean { return !!this.selfId && this.coordinator() === this.selfId; }
}
