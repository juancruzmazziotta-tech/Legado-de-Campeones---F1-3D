/**
 * Procedural Web Audio API Engine & Sensor Sound Synthesizer
 * Zero external audio files (100% generated in Web Audio API)
 */

export class F1SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isRunning: boolean = false;

  // Synthesis nodes
  private oscPrimary: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private oscTurbo: OscillatorNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;

  private gainPrimary: GainNode | null = null;
  private gainSub: GainNode | null = null;
  private gainTurbo: GainNode | null = null;
  private gainTireSqueal: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private filterLowpass: BiquadFilterNode | null = null;
  private filterTurbo: BiquadFilterNode | null = null;
  private filterSqueal: BiquadFilterNode | null = null;

  // Microphone Analyser
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micDataArray: Uint8Array<ArrayBuffer> | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public async initAudio(): Promise<boolean> {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return true;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Primary Engine Oscillator (Sawtooth)
      this.oscPrimary = this.ctx.createOscillator();
      this.oscPrimary.type = 'sawtooth';
      this.oscPrimary.frequency.setValueAtTime(65, this.ctx.currentTime);

      this.filterLowpass = this.ctx.createBiquadFilter();
      this.filterLowpass.type = 'lowpass';
      this.filterLowpass.frequency.setValueAtTime(800, this.ctx.currentTime);
      this.filterLowpass.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.gainPrimary = this.ctx.createGain();
      this.gainPrimary.gain.setValueAtTime(0.2, this.ctx.currentTime);

      this.oscPrimary.connect(this.filterLowpass);
      this.filterLowpass.connect(this.gainPrimary);
      this.gainPrimary.connect(this.masterGain);

      // 2. Sub / Rumble Oscillator (Triangle)
      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = 'triangle';
      this.oscSub.frequency.setValueAtTime(32, this.ctx.currentTime);

      this.gainSub = this.ctx.createGain();
      this.gainSub.gain.setValueAtTime(0.3, this.ctx.currentTime);

      this.oscSub.connect(this.gainSub);
      this.gainSub.connect(this.masterGain);

      // 3. Turbo Whine (High Sine through Bandpass)
      this.oscTurbo = this.ctx.createOscillator();
      this.oscTurbo.type = 'sine';
      this.oscTurbo.frequency.setValueAtTime(1400, this.ctx.currentTime);

      this.filterTurbo = this.ctx.createBiquadFilter();
      this.filterTurbo.type = 'bandpass';
      this.filterTurbo.frequency.setValueAtTime(2000, this.ctx.currentTime);
      this.filterTurbo.Q.setValueAtTime(5.0, this.ctx.currentTime);

      this.gainTurbo = this.ctx.createGain();
      this.gainTurbo.gain.setValueAtTime(0.01, this.ctx.currentTime);

      this.oscTurbo.connect(this.filterTurbo);
      this.filterTurbo.connect(this.gainTurbo);
      this.gainTurbo.connect(this.masterGain);

      // 4. Procedural Tire Squeal / Noise Buffer
      this.initTireNoiseBuffer();

      this.oscPrimary.start();
      this.oscSub.start();
      this.oscTurbo.start();

      this.isRunning = true;
      return true;
    } catch (err) {
      console.warn('AudioContext initialization deferred or restricted:', err);
      return false;
    }
  }

  private initTireNoiseBuffer(): void {
    if (!this.ctx || !this.masterGain) return;

    // Create 2 seconds of pinkish noise for tires and backfire
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.95 * b1 + white * 0.1;
      b2 = 0.85 * b2 + white * 0.25;
      output[i] = b0 + b1 + b2;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    this.filterSqueal = this.ctx.createBiquadFilter();
    this.filterSqueal.type = 'bandpass';
    this.filterSqueal.frequency.setValueAtTime(950, this.ctx.currentTime);
    this.filterSqueal.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.gainTireSqueal = this.ctx.createGain();
    this.gainTireSqueal.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.noiseNode.connect(this.filterSqueal);
    this.filterSqueal.connect(this.gainTireSqueal);
    this.gainTireSqueal.connect(this.masterGain);

    this.noiseNode.start();
  }

  /**
   * Update engine sound pitch & harmonics based on RPM & Throttle
   */
  public updateTelemetry(rpm: number, throttle: number, brake: number, lateralG: number): void {
    if (!this.ctx || !this.isRunning || this.isMuted) return;

    const t = this.ctx.currentTime;
    const normalizedRPM = Math.max(0.05, Math.min(1.0, rpm / 15000));

    // Base pitch: 60Hz idle up to 480Hz redline (plus harmonics)
    const baseFreq = 55 + normalizedRPM * 420;
    if (this.oscPrimary) {
      this.oscPrimary.frequency.setTargetAtTime(baseFreq, t, 0.04);
    }
    if (this.oscSub) {
      this.oscSub.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.04);
    }

    // Filter frequency opens up under throttle
    if (this.filterLowpass) {
      const cutoff = 600 + throttle * 4000 + normalizedRPM * 2500;
      this.filterLowpass.frequency.setTargetAtTime(cutoff, t, 0.05);
    }

    // Turbo whine pitch and volume
    if (this.oscTurbo && this.gainTurbo && this.filterTurbo) {
      const turboPitch = 1200 + normalizedRPM * 3200 + throttle * 1200;
      this.oscTurbo.frequency.setTargetAtTime(turboPitch, t, 0.08);
      this.filterTurbo.frequency.setTargetAtTime(turboPitch, t, 0.08);
      const turboVol = Math.max(0.005, throttle * 0.06 * (normalizedRPM + 0.2));
      this.gainTurbo.gain.setTargetAtTime(turboVol, t, 0.05);
    }

    // Tire squeal if high lateral G or hard braking
    if (this.gainTireSqueal) {
      const squealIntensity = Math.max(0, (Math.abs(lateralG) - 0.5) * 0.4) + (brake > 0.7 && normalizedRPM > 0.4 ? 0.2 : 0);
      const clampedSqueal = Math.min(0.25, squealIntensity);
      this.gainTireSqueal.gain.setTargetAtTime(clampedSqueal, t, 0.06);
    }

    // Primary gain volume
    if (this.gainPrimary && this.gainSub) {
      const engineGain = 0.15 + throttle * 0.25 + normalizedRPM * 0.15;
      this.gainPrimary.gain.setTargetAtTime(engineGain, t, 0.05);
      this.gainSub.gain.setTargetAtTime(engineGain * 0.7, t, 0.05);
    }
  }

  /**
   * Sound effect: Pop / Backfire on gear shift or throttle lift
   */
  public triggerBackfirePop(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'triangle';
      const now = this.ctx.currentTime;
      popOsc.frequency.setValueAtTime(140, now);
      popOsc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

      popGain.gain.setValueAtTime(0.4, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      popOsc.connect(popGain);
      if (this.masterGain) {
        popGain.connect(this.masterGain);
      }
      popOsc.start(now);
      popOsc.stop(now + 0.09);
    } catch {
      // Ignored
    }
  }

  /**
   * Sound effect: Starting lights beep
   */
  public playBeep(freq: number = 880, duration: number = 0.15): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch {
      // Ignored
    }
  }

  /**
   * Microphone Integration: captures microphone stream and calculates real-time volume
   */
  public async enableMicrophone(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!this.ctx) {
        await this.initAudio();
      }
      if (!this.ctx) return false;

      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micSource.connect(this.micAnalyser);
      // Notice: Do NOT connect micAnalyser to ctx.destination to avoid feedback squeal!
      this.micDataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
      return true;
    } catch (err) {
      console.warn('Microphone permission declined or unavailable:', err);
      return false;
    }
  }

  /**
   * Get real-time audio metrics from microphone (0.0 to 1.0)
   */
  public getAudioMetrics(): { volume: number; bassLevel: number } {
    if (!this.micAnalyser || !this.micDataArray) {
      return { volume: 0, bassLevel: 0 };
    }

    this.micAnalyser.getByteFrequencyData(this.micDataArray);
    let sum = 0;
    let bassSum = 0;
    const len = this.micDataArray.length;
    const bassCutoff = Math.floor(len * 0.2);

    for (let i = 0; i < len; i++) {
      const val = this.micDataArray[i];
      sum += val;
      if (i < bassCutoff) {
        bassSum += val;
      }
    }

    const volume = Math.min(1.0, sum / (len * 128));
    const bassLevel = Math.min(1.0, bassSum / (bassCutoff * 140));

    return { volume, bassLevel };
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  public dispose(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }
}

// Global audio engine singleton
export const audioManager = new F1SoundEngine();

// Safe Haptic feedback helper
export function triggerHaptic(pattern: number | number[] = 25): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported devices
  }
}
