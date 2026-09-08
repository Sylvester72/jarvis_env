export class AudioManager {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private audioChunks: Blob[] = [];
  private animationFrameId: number | null = null;
  private onAudioLevel: ((level: number) => void) | null = null;
  private onRecordingComplete: ((blob: Blob) => void) | null = null;
  private isCapturing = false;

  private static instance: AudioManager;

  constructor() {
    if (AudioManager.instance) {
      return AudioManager.instance;
    }
    AudioManager.instance = this;
  }

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async startCapture(
    onAudioLevel?: (level: number) => void,
    onRecordingComplete?: (blob: Blob) => void
  ): Promise<void> {
    if (this.isCapturing) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      this.audioContext = new AudioContext();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      this.onAudioLevel = onAudioLevel || null;
      this.onRecordingComplete = onRecordingComplete || null;

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.onRecordingComplete?.(blob);
        this.audioChunks = [];
      };

      this.mediaRecorder.start(100);
      this.isCapturing = true;

      this.startLevelDetection();
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  stopCapture(): Blob | null {
    if (!this.isCapturing) return null;

    this.mediaRecorder?.stop();
    this.stopLevelDetection();

    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;

    this.gainNode?.disconnect();
    this.analyser?.disconnect();
    this.sourceNode?.disconnect();

    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close();
    }

    this.audioContext = null;
    this.analyser = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.mediaRecorder = null;
    this.isCapturing = false;

    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
    this.audioChunks = [];
    return blob;
  }

  async playAudio(audioData: ArrayBuffer | Blob): Promise<void> {
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioContext();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.8;

      let audioBuffer: AudioBuffer;

      if (audioData instanceof ArrayBuffer) {
        audioBuffer = await this.audioContext.decodeAudioData(audioData);
      } else {
        const arrayBuffer = await audioData.arrayBuffer();
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      }

      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      source.start(0);

      return new Promise((resolve) => {
        source.onended = () => resolve();
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  private startLevelDetection(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const detect = () => {
      this.analyser!.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const level = Math.min(average / 128, 1);
      this.onAudioLevel?.(level);

      this.animationFrameId = requestAnimationFrame(detect);
    };

    detect();
  }

  private stopLevelDetection(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  isActive(): boolean {
    return this.isCapturing;
  }

  dispose(): void {
    this.stopCapture();
    this.onAudioLevel = null;
    this.onRecordingComplete = null;
  }
}

export function getAudioDevices(): Promise<{
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
}> {
  return navigator.mediaDevices.enumerateDevices().then((devices) => ({
    inputs: devices.filter((d) => d.kind === 'audioinput'),
    outputs: devices.filter((d) => d.kind === 'audiooutput'),
  }));
}

export function isAudioRecordingSupported(): boolean {
  return !!(
    navigator.mediaDevices?.getUserMedia &&
    window.MediaRecorder
  );
}
