/** Local audio level detection only; never records or uploads samples. */
export class ChatCallVoiceActivity {
  private readonly context: AudioContext | null;
  private readonly sources = new Map<string, { source: MediaStreamAudioSourceNode; analyser: AnalyserNode;
    samples: Float32Array<ArrayBuffer>; frequencies: Uint8Array<ArrayBuffer>; enabled: () => boolean; lastVoice: number }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = new Set<string>();
  private spectrum = '';
  constructor(private readonly changed: (speakers: ReadonlySet<string>) => void,
    private readonly levelsChanged: (levels: Readonly<Record<string, readonly number[]>>) => void) {
    try { this.context = typeof AudioContext === 'undefined' ? null : new AudioContext(); }
    catch { this.context = null; }
  }

  watch(id: string, stream: MediaStream, enabled: () => boolean): void {
    if (!this.context || this.sources.has(id) || !stream.getAudioTracks().length) return;
    try {
      const source = this.context.createMediaStreamSource(stream), analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.65;
      analyser.minDecibels = -85; analyser.maxDecibels = -20;
      source.connect(analyser); // No destination connection: no microphone feedback or duplicate playback.
      this.sources.set(id, { source, analyser, samples: new Float32Array(analyser.fftSize),
        frequencies: new Uint8Array(analyser.frequencyBinCount), enabled, lastVoice: -Infinity });
      if (!this.timer) this.timer = setInterval(() => this.sample(), 100);
      this.resume();
    } catch { /* Audio activity is optional when the browser does not expose an analyser. */ }
  }
  resume(): void { void this.context?.resume().catch(() => {}); }
  remove(id: string): void {
    const entry = this.sources.get(id);
    entry?.source.disconnect(); entry?.analyser.disconnect(); this.sources.delete(id);
    if (!this.sources.size && this.timer) { clearInterval(this.timer); this.timer = null; }
    this.sample();
  }
  private sample(): void {
    const active = new Set<string>(), now = performance.now(), levels: Record<string, number[]> = {};
    for (const [id, entry] of this.sources) {
      if (!entry.enabled() || this.context?.state !== 'running') { entry.lastVoice = -Infinity; continue; }
      entry.analyser.getFloatTimeDomainData(entry.samples);
      const rms = Math.sqrt(entry.samples.reduce((sum, value) => sum + value * value, 0) / entry.samples.length);
      if (rms >= 0.025) entry.lastVoice = now;
      if (now - entry.lastVoice < 350) {
        active.add(id);
        entry.analyser.getByteFrequencyData(entry.frequencies);
        // Forty-eight logarithmic FFT bands across voice and harmonics; quantize idle renders.
        levels[id] = Array.from({ length: 48 }, (_, band) => {
          const low = Math.floor(80 * 100 ** (band / 48) / (this.context!.sampleRate / entry.analyser.fftSize));
          const high = Math.min(entry.frequencies.length, Math.max(low + 1,
            Math.ceil(80 * 100 ** ((band + 1) / 48) / (this.context!.sampleRate / entry.analyser.fftSize))));
          let peak = 0;
          for (let bin = low; bin < high; bin++) peak = Math.max(peak, entry.frequencies[bin]);
          return Math.round(peak / 255 * 16) / 16;
        });
      }
    }
    if (active.size !== this.active.size || [...active].some(id => !this.active.has(id))) {
      this.active = active; this.changed(active);
    }
    const spectrum = JSON.stringify(levels);
    if (spectrum !== this.spectrum) { this.spectrum = spectrum; this.levelsChanged(levels); }
  }
  destroy(): void {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    for (const entry of this.sources.values()) { entry.source.disconnect(); entry.analyser.disconnect(); }
    this.sources.clear(); this.active.clear(); this.changed(new Set());
    this.spectrum = ''; this.levelsChanged({});
    void this.context?.close().catch(() => {});
  }
}
