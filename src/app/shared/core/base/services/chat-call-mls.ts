import type * as MLS from '@wireapp/core-crypto/browser';

let library: Promise<typeof MLS> | undefined;
const loadLibrary = () => library ??= import('@wireapp/core-crypto/browser').then(async api => {
  await api.initWasmModule(new URL('assets/chat-call-crypto/index_bg.wasm', document.baseURI).href);
  return api;
});
const bytes = (value: string) => new TextEncoder().encode(value);
export function encodeCallBytes(buffer: Uint8Array): string {
  if (buffer.length > 32768) throw new Error('Call message too large.');
  return btoa(String.fromCharCode(...buffer));
}
export function decodeCallBytes(value: string): Uint8Array {
  if (value.length > 49152) throw new Error('Call message too large.');
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
export interface CallMlsCommit { commit: string; welcome?: string; members: string[]; }

/** RFC 9420 group state, owned by Wire CoreCrypto, with a call-scoped in-memory keystore. */
export class ChatCallMls {
  readonly clientId = crypto.randomUUID();
  private readonly conversation: MLS.ConversationId;
  private credential!: MLS.CredentialRef;
  private keyPackage = '';
  private commitMembers: string[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private alive = true;
  private constructor(private readonly api: typeof MLS, private readonly core: MLS.CoreCrypto,
    private readonly database: MLS.Database, callId: string) {
    this.conversation = new api.ConversationId(bytes(callId));
  }
  static async create(callId: string, sendCommit: (bundle: CallMlsCommit) => Promise<void>): Promise<ChatCallMls> {
    const api = await loadLibrary(), database = await api.Database.inMemory();
    const result = new ChatCallMls(api, api.CoreCrypto.new(database), database, callId);
    try {
      await result.core.transaction(async ctx => {
        const client = result.client(result.clientId);
        await ctx.mlsInit(client, {
          sendCommitBundle: async bundle => sendCommit({ commit: encodeCallBytes(bundle.commit), members: [...result.commitMembers],
            ...(bundle.welcome ? { welcome: encodeCallBytes(bundle.welcome.serialize()) } : {}) }),
          prepareForTransport: async () => { throw new Error('Call history sharing is disabled.'); }
        });
        result.credential = await ctx.addCredential(api.Credential.basic(api.CipherSuite.Mls128Dhkemx25519Aes128gcmSha256Ed25519, client));
        const keyPackage = await ctx.generateKeyPackage(result.credential, 3600);
        result.keyPackage = encodeCallBytes(keyPackage.serialize());
      });
      return result;
    } catch (error) { await result.destroy(); throw error; }
  }
  bundle(): string { return this.keyPackage; }
  private client(id: string): MLS.ClientId {
    return new this.api.ClientId(new this.api.Uuid(id), new this.api.DeviceId(0n), 'call.myscoutee');
  }
  private run<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => {
      if (!this.alive) throw new Error('Call ended.');
      return operation();
    });
    this.queue = next.catch(() => {});
    return next;
  }
  exists(): Promise<boolean> { return this.run(() => this.core.conversationExists(this.conversation)); }
  /** Only the elected coordinator changes membership; transport acceptance precedes merging a commit. */
  reconcile(members: readonly { clientId: string; bundle: string }[]): Promise<void> {
    return this.run(async () => {
      if (!await this.core.conversationExists(this.conversation)) {
        await this.core.transaction(ctx => ctx.createConversation(this.conversation, this.credential));
      }
      let current = await this.core.getClientIds(this.conversation);
      const departed = current.filter(client => !members.some(member => member.clientId === client.deserialize().userId.toString()));
      if (departed.length) {
        this.commitMembers = current.filter(client => !departed.some(left => left.equals(client))).map(client => client.deserialize().userId.toString());
        await this.core.transaction(ctx => ctx.removeClientsFromConversation(this.conversation, departed));
      }
      current = await this.core.getClientIds(this.conversation);
      const missing = members.filter(member => !current.some(client => client.deserialize().userId.toString() === member.clientId));
      if (missing.length) {
        this.commitMembers = members.map(member => member.clientId);
        await this.core.transaction(ctx => ctx.addClientsToConversation(this.conversation,
          missing.map(member => new this.api.KeyPackage(decodeCallBytes(member.bundle)))));
      }
      await this.assertMembers(members.map(member => member.clientId));
    });
  }
  accept(bundle: CallMlsCommit): Promise<void> {
    return this.run(async () => {
      await this.core.transaction(async ctx => {
        if (!await ctx.conversationExists(this.conversation)) {
          if (!bundle.welcome) throw new Error('Missing MLS Welcome.');
          const id = await ctx.processWelcomeMessage(new this.api.Welcome(decodeCallBytes(bundle.welcome)));
          if (!id.equals(this.conversation)) throw new Error('MLS call context mismatch.');
        } else {
          const result = await ctx.decryptMessage(this.conversation, decodeCallBytes(bundle.commit));
          if (result.tag !== 'Commit' || !result.inner.isActive) throw new Error('Invalid MLS membership commit.');
          if (result.inner.bufferedMessages?.length) throw new Error('Unordered call signaling.');
        }
      });
      await this.assertMembers(bundle.members);
    });
  }
  memberIds(): Promise<string[]> { return this.run(async () => (await this.core.getClientIds(this.conversation)).map(client => client.deserialize().userId.toString())); }
  validateMembers(ids: readonly string[]): Promise<void> { return this.run(() => this.assertMembers(ids)); }
  private async assertMembers(ids: readonly string[]): Promise<void> {
    const current = (await this.core.getClientIds(this.conversation)).map(client => client.deserialize().userId.toString()).sort();
    if (JSON.stringify(current) !== JSON.stringify([...ids].sort())) throw new Error('MLS roster identity mismatch.');
  }
  encrypt(payload: object): Promise<string> {
    return this.run(() => this.core.transaction(async ctx => encodeCallBytes(await ctx.encryptMessage(this.conversation, bytes(JSON.stringify(payload))))));
  }
  decrypt(ciphertext: string): Promise<{ clientId: string; plaintext: string }> {
    return this.run(() => this.core.transaction(async ctx => {
      const result = await ctx.decryptMessage(this.conversation, decodeCallBytes(ciphertext));
      if (result.tag !== 'Text') throw new Error('Expected an MLS application message.');
      return { clientId: result.inner.senderClientId.deserialize().userId.toString(), plaintext: new TextDecoder().decode(result.inner.plaintext) };
    }));
  }
  verificationCode(): Promise<string> {
    return this.run(async () => {
      const exported = await this.core.exportSecretKey(this.conversation, 32), secret = exported.copyBytes();
      try {
        const hash = await crypto.subtle.digest('SHA-256', secret as Uint8Array<ArrayBuffer>);
        return Array.from(new Uint8Array(hash).slice(0, 12), byte => byte.toString(16).padStart(2, '0')).join('').match(/.{1,4}/g)!.join(' ');
      } finally { secret.fill(0); exported.uniffiDestroy(); }
    });
  }
  async destroy(): Promise<void> {
    if (!this.alive) return;
    this.alive = false;
    await this.queue;
    try {
      if (await this.core.conversationExists(this.conversation)) await this.core.transaction(ctx => ctx.wipeConversation(this.conversation));
    } finally { this.core.uniffiDestroy(); this.database.uniffiDestroy(); this.conversation.uniffiDestroy(); this.keyPackage = ''; }
  }
}
