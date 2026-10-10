import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Input, QueryList, ViewChildren, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { of } from 'rxjs';
import { ChatCallService } from '../../../shared/core/base/services/chat-call.service';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import {
  ExplanationGuideService,
  PopupComponent,
  SmartListComponent,
  type PopupModel,
  type SmartListConfig,
  type SmartListLoadPage
} from '@myscoutee/components';

interface CallPage {
  id: string;
  ids: string[];
  self: boolean;
  peers: ReturnType<ChatCallService['tiles']>;
  columns: number;
}

@Component({
  selector: 'app-chat-call-popup', standalone: true,
  imports: [MatIconModule, PopupComponent, SmartListComponent],
  template: `
    @if (call.open()) {
      <app-popup [model]="model()" [zIndex]="zIndex">
        <section class="call" data-chat-call [attr.data-call-state]="call.status()">
          @if (call.error(); as error) { <p class="call-error" role="alert">{{ t(error) }}</p> }
          @if (call.notice(); as notice) { <p role="status">{{ t(notice) }}</p> }
          @for (peer of call.tiles(); track peer.id) {
            <audio #remoteMedia [srcObject]="peer.stream" autoplay [muted]="call.speakerMuted() || !!call.peerMuted()[peer.id] || peer.mutedByAdmin"
              [volume]="call.playbackVolume(peer.id)" (loadedmetadata)="playMedia(remoteMedia)"></audio>
          }
          <div class="call-stage" data-guide-field="call-participants" #callStage>
            <app-smart-list #participantList class="call-participants" [config]="participantsConfig" [loadPage]="loadParticipants"
              [itemTemplate]="participantPage" (viewportItemsChange)="visiblePages($event)"></app-smart-list>
          </div>
          <ng-template #participantPage let-page>
            <div class="call-grid" [class.call-grid-single]="page.ids.length === 1" [style.--call-columns]="page.columns" [attr.data-call-page]="page.id">
              @if (page.self) {
              <article class="call-tile" [hidden]="focused() && focused() !== 'self'"
                [style.order]="page.ids.indexOf('self')"
                [class.call-muted]="call.muted() || call.adminMuted()"
                [class.call-speaking]="call.activeSpeakers().has('self')" [attr.data-coordinator]="call.isSelfCoordinator()">
                  <button type="button" class="call-mic-state" data-call-tile-mute="self" data-guide-field="call-self-mute" (click)="call.toggleMute()"
                    [attr.data-call-mic-state]="call.muted() || call.adminMuted() ? 'muted' : call.activeSpeakers().has('self') ? 'speaking' : 'idle'"
                    [disabled]="!call.localStream() || call.adminMuted()" [attr.aria-pressed]="call.muted() || call.adminMuted()"
                    [attr.aria-label]="t(call.muted() ? 'chat.call.unmute' : 'chat.call.mute')">
                    <mat-icon>{{ call.muted() || call.adminMuted() ? 'mic_off' : 'mic' }}</mat-icon>
                  </button>
                  <button type="button" class="call-camera-state" data-call-tile-camera="self" data-guide-field="call-self-camera" (click)="call.toggleCamera()"
                    [attr.data-call-camera-state]="call.cameraOff() ? 'off' : 'on'" [attr.aria-pressed]="call.cameraOff()"
                    [disabled]="!call.localStream() || call.cameraPending()" [attr.aria-label]="t('chat.call.camera')">
                    <mat-icon>{{ call.cameraOff() ? 'videocam_off' : 'videocam' }}</mat-icon>
                  </button>
                  <button type="button" class="tile-zoom" data-guide-field="call-zoom" data-call-zoom="self" (click)="zoom('self')"
                    [attr.aria-label]="t(focused() === 'self' ? 'chat.call.restore.grid' : 'chat.call.enlarge')"
                    [attr.aria-pressed]="focused() === 'self'"><mat-icon>{{ focused() === 'self' ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon></button>
                  @if (call.localStream(); as stream) {
                    <video [srcObject]="stream" autoplay playsinline [muted]="true" [hidden]="call.cameraOff()"></video>
                  }
                  @if (call.cameraOff() || !call.localStream()) { <mat-icon class="avatar">person</mat-icon> }
                  @if (call.audioLevels()['self']; as levels) {
                    <div class="call-wave" data-guide-field="call-spectrum" data-call-wave="self" role="img" [attr.aria-label]="t('chat.call.speaking')">
                      @for (level of levels; track $index) { <i [style.height.%]="Math.max(8, level * 100)"></i> }
                    </div>
                  }
                  <span>{{ t('chat.call.you') }}
                    @if (call.adminMuted()) { <small>{{ t('chat.call.admin.muted') }}</small> }
                    @if (call.isSelfCoordinator()) { <small>{{ t('chat.call.coordinator') }}</small> }
                  </span>
              </article>
              }
              @for (peer of page.peers; track peer.id) {
                <article class="call-tile" [attr.data-call-peer]="peer.id" [attr.data-peer-state]="peer.state"
                  [style.order]="page.ids.indexOf(peer.id)"
                  [attr.data-coordinator]="call.coordinator() === peer.id" [hidden]="focused() && focused() !== peer.id"
                  [class.call-speaking]="call.activeSpeakers().has(peer.id)"
                  [class.call-muted]="call.speakerMuted() || !!call.peerMuted()[peer.id] || peer.mutedByAdmin">
                  <button type="button" class="call-mic-state" [attr.data-call-tile-mute]="peer.id" data-guide-field="call-peer-mute" (click)="call.togglePeerMute(peer.id)"
                    [attr.data-call-mic-state]="call.speakerMuted() || call.peerMuted()[peer.id] || peer.mutedByAdmin ? 'muted' : call.activeSpeakers().has(peer.id) ? 'speaking' : 'idle'"
                    [attr.aria-pressed]="call.speakerMuted() || !!call.peerMuted()[peer.id] || peer.mutedByAdmin"
                    [disabled]="call.speakerMuted() || peer.mutedByAdmin"
                    [attr.aria-label]="t('chat.call.speaker') + ': ' + (peer.name || t('chat.call.participant'))">
                    <mat-icon>{{ call.speakerMuted() || call.peerMuted()[peer.id] || peer.mutedByAdmin ? 'mic_off' : 'mic' }}</mat-icon>
                  </button>
                  <button type="button" class="call-camera-state" [attr.data-call-tile-camera]="peer.id" data-guide-field="call-peer-video" (click)="call.toggleReceivingVideo(peer.id)"
                    [attr.data-call-camera-state]="peer.cameraOn && call.allowsVideo(peer.id) ? 'on' : 'off'" [attr.aria-pressed]="!peer.cameraOn || !call.allowsVideo(peer.id)"
                    [attr.aria-label]="t(call.allowsVideo(peer.id) ? 'chat.call.receive.video.off' : 'chat.call.receive.video.on') + ': ' + (peer.name || t('chat.call.participant'))">
                    <mat-icon>{{ peer.cameraOn && call.allowsVideo(peer.id) ? 'videocam' : 'videocam_off' }}</mat-icon>
                  </button>
                  <button type="button" class="tile-zoom" data-guide-field="call-zoom" [attr.data-call-zoom]="peer.id" (click)="zoom(peer.id)"
                    [attr.aria-label]="t(focused() === peer.id ? 'chat.call.restore.grid' : 'chat.call.enlarge')"
                    [attr.aria-pressed]="focused() === peer.id"><mat-icon>{{ focused() === peer.id ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon></button>
                  @if (call.canModerate()) {
                    <button type="button" class="tile-mute" [attr.data-call-moderate]="peer.id" data-guide-field="call-admin-mute" (click)="call.moderate(peer.id, !peer.mutedByAdmin)"
                      [attr.aria-label]="t(peer.mutedByAdmin ? 'chat.call.admin.release' : 'chat.call.admin.mute')"
                      [attr.aria-pressed]="peer.mutedByAdmin"><mat-icon>{{ peer.mutedByAdmin ? 'mic_off' : 'mic' }}</mat-icon></button>
                  }
                  <video [srcObject]="peer.stream" autoplay playsinline [hidden]="!peer.video" [muted]="true"></video>
                  @if (!peer.video) { <mat-icon class="avatar">person</mat-icon> }
                  @if (call.audioLevels()[peer.id]; as levels) {
                    <div class="call-wave" data-guide-field="call-spectrum" [attr.data-call-wave]="peer.id" role="img" [attr.aria-label]="t('chat.call.speaking')">
                      @for (level of levels; track $index) { <i [style.height.%]="Math.max(8, level * 100)"></i> }
                    </div>
                  }
                  <span>{{ peer.name || t('chat.call.participant') }}
                    <small>{{ t('chat.call.peer.' + peer.state) }}</small>
                    @if (peer.mutedByAdmin) { <small>{{ t('chat.call.admin.muted') }}</small> }
                    @if (call.coordinator() === peer.id) { <small>{{ t('chat.call.coordinator') }}</small> }
                  </span>
                </article>
              }
            </div>
          </ng-template>
          @if (call.status() === 'incoming') {
            <div class="call-actions">
              <button type="button" class="primary" data-call-accept data-guide-field="call-accept" (click)="call.join(false)" [disabled]="!call.available()">
                <mat-icon>call</mat-icon>{{ t('chat.call.accept.audio') }}
              </button>
              <button type="button" class="danger" data-call-decline data-guide-field="call-decline" (click)="call.decline()">{{ t('chat.call.decline') }}</button>
            </div>
          } @else {
            @if (audioBlocked()) { <button type="button" data-guide-field="call-play-audio" (click)="enableAudio()">{{ t('chat.call.play.audio') }}</button> }
            <div class="call-actions">
              <button type="button" data-call-mute data-guide-field="call-microphone" [attr.aria-pressed]="call.muted()" (click)="call.toggleMute()"
                [disabled]="!call.localStream() || call.adminMuted()" [attr.aria-label]="t(call.muted() ? 'chat.call.unmute' : 'chat.call.mute')">
                <mat-icon>{{ call.muted() ? 'mic_off' : 'mic' }}</mat-icon>
              </button>
              <button type="button" data-call-camera data-guide-field="call-camera" [attr.aria-pressed]="call.cameraOff()" (click)="call.toggleCamera()"
                [disabled]="!call.localStream() || call.cameraPending()" [attr.aria-label]="t('chat.call.camera')">
                <mat-icon>{{ call.cameraOff() ? 'videocam_off' : 'videocam' }}</mat-icon>
              </button>
              <button type="button" data-call-volume-button data-guide-field="call-volume" [attr.aria-expanded]="!!volumePanel()" (click)="toggleVolume($event)"
                [class.call-control-muted]="call.speakerMuted()"
                [attr.aria-label]="t('chat.call.volume')"><mat-icon>{{ call.speakerMuted() ? 'volume_off' : 'volume_up' }}</mat-icon></button>
              <button type="button" class="danger" data-call-hangup data-guide-field="call-hangup" (click)="call.close()" [attr.aria-label]="t('chat.call.hangup')">
                <mat-icon>call_end</mat-icon>{{ t('chat.call.hangup') }}
              </button>
            </div>
            @if (volumePanel(); as volumeModel) {
              <app-popup [model]="volumeModel" [zIndex]="zIndex + 100" (close)="volumePanel.set(null)">
              <div class="call-volumes">
                <fieldset class="volume-channel"><legend>{{ t('chat.call.me') }}</legend>
                  <input type="range" data-call-volume data-guide-field="master-volume" min="0" max="100" step="5" [value]="call.volume()"
                    [attr.aria-label]="t('chat.call.volume')" (input)="setVolume($event)"><output>{{ call.volume() }}%</output>
                  <button type="button" data-call-speaker data-guide-field="master-mute" [attr.aria-pressed]="call.speakerMuted()"
                    (click)="call.speakerMuted.update(toggle)" [attr.aria-label]="t('chat.call.speaker')">
                    <mat-icon>{{ call.speakerMuted() ? 'volume_off' : 'volume_up' }}</mat-icon>
                  </button>
                  <button type="button" data-call-volume-camera data-guide-field="self-camera" [attr.aria-pressed]="call.cameraOff()"
                    [disabled]="!call.localStream() || call.cameraPending()" (click)="call.toggleCamera()" [attr.aria-label]="t('chat.call.camera')">
                    <mat-icon>{{ call.cameraOff() ? 'videocam_off' : 'videocam' }}</mat-icon>
                  </button>
                </fieldset>
                @for (peer of call.tiles(); track peer.id) {
                  <fieldset class="volume-channel"><legend>{{ peer.name || t('chat.call.participant') }}</legend>
                    <input type="range" [attr.data-call-peer-volume]="peer.id" data-guide-field="peer-volume" min="0" max="100" step="5" [value]="call.peerVolumes()[peer.id] ?? 100"
                      [attr.aria-label]="t('chat.call.volume') + ': ' + (peer.name || t('chat.call.participant'))" (input)="setVolume($event, peer.id)">
                    <output>{{ call.peerVolumes()[peer.id] ?? 100 }}%</output>
                    <button type="button" [attr.data-call-peer-mute]="peer.id" data-guide-field="peer-mute" [attr.aria-pressed]="call.speakerMuted() || !!call.peerMuted()[peer.id] || peer.mutedByAdmin"
                      [disabled]="call.speakerMuted() || peer.mutedByAdmin"
                      (click)="call.togglePeerMute(peer.id)" [attr.aria-label]="t('chat.call.speaker') + ': ' + (peer.name || t('chat.call.participant'))">
                      <mat-icon>{{ call.speakerMuted() || call.peerMuted()[peer.id] || peer.mutedByAdmin ? 'volume_off' : 'volume_up' }}</mat-icon>
                    </button>
                    <button type="button" [attr.data-call-peer-receive-video]="peer.id" data-guide-field="peer-video" [attr.aria-pressed]="!peer.cameraOn || !call.allowsVideo(peer.id)"
                      (click)="call.toggleReceivingVideo(peer.id)"
                      [attr.aria-label]="t(call.allowsVideo(peer.id) ? 'chat.call.receive.video.off' : 'chat.call.receive.video.on') + ': ' + (peer.name || t('chat.call.participant'))">
                      <mat-icon>{{ peer.cameraOn && call.allowsVideo(peer.id) ? 'videocam' : 'videocam_off' }}</mat-icon>
                    </button>
                  </fieldset>
                }
              </div>
              </app-popup>
            }
          }
        </section>
      </app-popup>
    }
  `,
  styles: [`
    .call { padding: 16px; display: flex; flex-direction: column; gap: 14px; height: 100%; min-height: 0; box-sizing: border-box; overflow: auto; }
    .call p { margin: 0; color: var(--text-secondary, #526076); }
    .call .call-error { color: #b42318; }
    .call-stage { flex: 1; min-height: 240px; min-width: 0; display: flex; }
    .call-participants { --smart-list-horizontal-mobile-surface-margin: 0; }
    :host ::ng-deep .call-participants .smart-list__surface { padding-top: 0; }
    :host ::ng-deep .call-participants .smart-list--horizontal { padding: 0; }
    .call-grid { flex: 1; width: 100%; min-width: 0; height: 100%; min-height: 0; box-sizing: border-box; display: grid; grid-template-columns: repeat(var(--call-columns, 2), minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 10px; }
    .call-tile { position: relative; overflow: hidden; border-radius: 12px; min-height: 160px; background: #182235; color: white; display: grid; place-items: center; }
    .call-grid-single { grid-template-columns: minmax(0, 1fr); }
    .call-tile[hidden] { display: none; }
    .call-speaking { --call-frame-color: #36d58a; }
    .call-muted { --call-frame-color: #ef4444; }
    .call-speaking, .call-muted { box-shadow: inset 0 0 0 4px var(--call-frame-color); }
    .call-speaking::after, .call-muted::after { content: ''; position: absolute; inset: 0; border: 4px solid var(--call-frame-color); border-radius: 12px; pointer-events: none; z-index: 1; }
    .call-tile button.call-mic-state, .call-tile button.call-camera-state { position: absolute; left: 8px; z-index: 2; display: grid; place-items: center; width: 36px; height: 36px; min-height: 36px; padding: 6px; border-radius: 8px; background: #000b; color: #d1d9e6; }
    .call-tile button.call-mic-state { top: 8px; color: var(--call-frame-color, #d1d9e6); }
    .call-tile button.call-camera-state { top: 52px; }
    .call-tile button.call-camera-state[aria-pressed=true] { color: #ef4444; }
    .call-tile button.call-mic-state:focus-visible, .call-tile button.call-camera-state:focus-visible { outline: 2px solid #76b7ff; outline-offset: 2px; }
    .call-wave { position: absolute; bottom: 44px; left: 12px; right: 12px; height: 40px; display: flex; align-items: center; justify-content: center; gap: 2px; pointer-events: none; z-index: 2; }
    .call-wave i { flex: 1; max-width: 6px; border-radius: 2px; background: var(--call-frame-color, #36d58a); transition: height 80ms linear; }
    button.tile-zoom, button.tile-mute { position: absolute; top: 8px; right: 8px; z-index: 2; background: #0008; color: white; min-height: 36px; padding: 6px; }
    button.tile-mute { right: 52px; }
    button.tile-mute[aria-pressed=true] { background: #b42318; }
    .call-tile button.tile-zoom, .call-tile button.tile-zoom[aria-pressed=true] { background: #f8faff; color: #182235; border: 1px solid #fff; box-shadow: 0 1px 5px #0006; }
    .call-tile button.tile-zoom:focus-visible { outline: 3px solid #76b7ff; outline-offset: 2px; }
    video { position: absolute; width: 100%; height: 100%; object-fit: contain; }
    video[hidden] { display: none; }
    .avatar { font-size: 52px; width: 52px; height: 52px; margin-bottom: 35px; }
    .call-tile > span { position: absolute; bottom: 0; left: 0; right: 0; padding: 9px; background: #0008; font-size: 13px; display: flex; flex-wrap: wrap; gap: 7px; }
    small { font-size: 11px; opacity: .85; }
    .call-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    button { display: inline-flex; gap: 7px; align-items: center; justify-content: center; min-height: 42px; padding: 9px 13px; border: 0; border-radius: 10px; cursor: pointer; background: #e8edf5; color: #182235; }
    button:disabled { opacity: .5; cursor: default; }
    button.primary { background: #2563eb; color: white; }
    button.danger { background: #dc2626; color: white; }
    button[aria-pressed=true] { background: #fce2e2; }
    button.call-control-muted { background: #fce2e2; color: #b42318; }
    .call-volumes { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 4px 12px 12px; min-height: 0; overflow-y: auto; }
    .volume-channel { display: grid; grid-template-columns: minmax(60px, 1fr) 34px 30px 30px; align-items: center; gap: 6px; min-width: 0; margin: 0; padding: 8px; border: 1px solid #bad5f2; border-radius: 9px; background: #eef6ff; color: #203b5e; font-size: 13px; }
    .volume-channel legend { max-width: 100%; padding: 0 5px; font-weight: 600; overflow-wrap: anywhere; }
    .volume-channel:nth-child(4n+2) { background: #edf9f2; border-color: #b5ddc5; color: #22523c; }
    .volume-channel:nth-child(4n+3) { background: #f4efff; border-color: #d1c1ee; color: #554279; }
    .volume-channel:nth-child(4n+4) { background: #fff7e7; border-color: #ecd3a3; color: #735521; }
    .call-volumes input { width: 100%; min-width: 0; accent-color: #2563eb; }
    .volume-channel button { min-height: 32px; padding: 4px; }
    @media(min-width: 761px) { .call-volumes { grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); } }
    @media(max-width: 760px) { .call-tile { min-height: 0; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatCallPopupComponent {
  protected readonly call = inject(ChatCallService);
  protected readonly Math = Math;
  private readonly i18n = inject(I18nService);
  protected readonly audioBlocked = signal(false);
  protected readonly volumePanel = signal<PopupModel | null>(null);
  protected toggleVolume(event: Event): void {
    event.stopPropagation();
    if (this.volumePanel()) { this.volumePanel.set(null); return; }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(), width = this.call.tiles().length ? 560 : 320;
    this.volumePanel.set({ title: 'chat.call.volume', ariaLabel: 'chat.call.volume', size: 'default',
      backdrop: false, closeOnBackdrop: false, mobilePresentation: 'compact', bodyLayout: 'flush',
      anchorRect: { left: rect.left + rect.width / 2 - width / 2, top: rect.top, width } });
  }
  protected setVolume(event: Event, id?: string): void { this.call.setVolume(Number((event.target as HTMLInputElement).value), id); }
  private readonly selectedTile = signal<string | null>(null);
  protected readonly focused = computed(() => this.call.open() && (this.selectedTile() === 'self'
    || this.call.tiles().some(tile => tile.id === this.selectedTile())) ? this.selectedTile() : null);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('callStage');
  private readonly participantList = viewChild<SmartListComponent<CallPage>>('participantList');
  private readonly stageSize = signal({ width: 320, height: 320 });
  private readonly compactMedia = globalThis.matchMedia?.('(max-width: 760px)');
  private readonly compact = signal(this.compactMedia?.matches ?? true);
  protected readonly followSpeakers = signal(false);
  private readonly recentSpeakers = signal<readonly string[]>([]);
  private previousSpeakers: ReadonlySet<string> = new Set();
  private followedOrder = '';
  private readonly columns = computed(() => this.compact() ? 2
    : Math.max(1, Math.min(3, Math.floor((this.stageSize().width + 10) / 300))));
  private readonly capacity = computed(() => this.compact() ? 4 : this.columns() * Math.max(1,
    Math.min(2, Math.floor((this.stageSize().height + 10) / 170))));
  private readonly pages = computed<CallPage[]>(() => {
    const peers = this.call.tiles(), focus = this.focused();
    const ids = focus ? [focus] : ['self', ...peers.map(peer => peer.id)];
    if (!focus && this.followSpeakers()) {
      const active = this.call.activeSpeakers(), recent = this.recentSpeakers();
      const rank = (id: string) => { const index = recent.indexOf(id); return index < 0 ? recent.length : index; };
      ids.sort((a, b) => Number(active.has(b)) - Number(active.has(a)) || rank(a) - rank(b));
    }
    const pages: CallPage[] = [], capacity = focus ? 1 : this.capacity();
    for (let index = 0; index < ids.length; index += capacity) {
      const pageIds = ids.slice(index, index + capacity);
      pages.push({ id: String(index / capacity), ids: pageIds, self: pageIds.includes('self'),
        peers: pageIds.flatMap(id => peers.filter(peer => peer.id === id)), columns: Math.min(this.columns(), pageIds.length) });
    }
    return pages;
  });
  protected readonly participantsConfig: SmartListConfig<CallPage> = {
    pageSize: 16, initialPageSize: 16, mobilePageSizeCap: null, showStickyHeader: false, showGroupMarker: () => false,
    trackBy: (_index, page) => page.id, orientation: 'horizontal', compactHorizontal: true,
    desktopColumns: 1, snapMode: 'mandatory', mobileStepper: true,
    headerProgress: { enabled: false }, pagination: { mode: 'arrows', step: 'page' }
  };
  protected readonly loadParticipants: SmartListLoadPage<CallPage> = () => {
    const pages = untracked(this.pages); return of({ items: pages, total: pages.length });
  };
  protected visiblePages(pages: readonly CallPage[]): void {
    void this.call.setVisibleVideoPeers(pages.flatMap(page => page.peers.map(peer => peer.id)));
  }
  protected zoom(id: string): void { this.selectedTile.set(this.focused() === id ? null : id); }
  protected readonly toggle = (value: boolean) => !value;
  @Input() zIndex = 2400;
  @ViewChildren('remoteMedia') private media?: QueryList<ElementRef<HTMLAudioElement>>;
  private readonly guide = inject(ExplanationGuideService);
  constructor() {
    effect(onCleanup => {
      if (this.call.open()) onCleanup(untracked(() => this.guide.registerContext('chat.call')));
    });
    effect(onCleanup => {
      if (this.call.open() && this.volumePanel()) onCleanup(untracked(() => this.guide.registerContext('chat.call.volume')));
    });
    const updateCompact = () => this.compact.set(this.compactMedia?.matches ?? true);
    this.compactMedia?.addEventListener('change', updateCompact);
    inject(DestroyRef).onDestroy(() => this.compactMedia?.removeEventListener('change', updateCompact));
    effect(onCleanup => {
      const stage = this.stage(); if (!stage) return;
      const observer = new ResizeObserver(([entry]) => this.stageSize.set({ width: entry.contentRect.width, height: entry.contentRect.height }));
      observer.observe(stage.nativeElement); onCleanup(() => observer.disconnect());
    });
    effect(() => {
      const pages = this.pages(), list = this.participantList(), follow = this.followSpeakers(), focus = this.focused();
      if (list) untracked(() => {
        list.syncVisibleItems(pages, { total: pages.length, hasMore: false });
        const order = pages.flatMap(page => page.ids).join('|');
        if (follow && !focus && order !== this.followedOrder) {
          this.followedOrder = order; void list.setCursorIndex(0);
        } else if (!follow) this.followedOrder = '';
      });
    });
    effect(() => {
      const active = this.call.activeSpeakers(), entered = [...active].filter(id => !this.previousSpeakers.has(id));
      this.previousSpeakers = active;
      if (entered.length) this.recentSpeakers.update(recent => [...entered.reverse(), ...recent.filter(id => !entered.includes(id))]);
    });
    effect(() => {
      if (!this.call.open()) {
        this.selectedTile.set(null); this.volumePanel.set(null); this.audioBlocked.set(false); this.recentSpeakers.set([]); this.previousSpeakers = new Set();
      }
    });
  }
  protected t(key: string): string { return this.i18n.translate(key); }
  protected readonly model = computed<PopupModel>(() => ({ title: this.t('chat.call.title'), subtitle: this.call.title(), translateSubtitle: false,
      ariaLabel: this.t('chat.call.title'), closeAriaLabel: this.t('chat.call.close'),
      size: 'wide', height: 'full', bodyLayout: 'fill', headerTone: 'accent', backdropTone: 'dim', closeOnBackdrop: false,
      headerControls: [{ id: 'call-follow-speakers', kind: 'menu', menuKind: 'inline', items: [{
        id: 'follow-speakers', kind: 'toggle', layout: 'pill', icon: 'record_voice_over', label: 'chat.call.follow.speakers',
        palette: 'blue', showToggleIndicator: true, checked: () => this.followSpeakers(), closeOnSelect: false
      }] }], onMenuSelect: event => { if (event.itemSelect.item.id === 'follow-speakers') this.followSpeakers.update(this.toggle); },
      onClose: () => { void this.call.close(); } }));
  protected playMedia(element: HTMLMediaElement): void {
    void element.play().catch(() => this.audioBlocked.set(true));
  }
  protected async enableAudio(): Promise<void> {
    this.call.resumeAudio();
    const results = await Promise.allSettled(this.media?.map(media => media.nativeElement.play()) ?? []);
    this.audioBlocked.set(results.some(result => result.status === 'rejected'));
  }
}
