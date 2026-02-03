import { TextToken } from '../types';

export interface TTSSettings {
  rate: number; // 0.5 - 2.0
  pitch: number; // 0.5 - 2.0
  volume: number; // 0 - 1
  voice?: SpeechSynthesisVoice;
  enabled: boolean;
}

export class TextToSpeechManager {
  private synth: SpeechSynthesis;
  private settings: TTSSettings;
  // Track current utterance for potential future use
  private isPlaying: boolean = false;
  private isPaused: boolean = false;

  constructor(settings: Partial<TTSSettings> = {}) {
    this.synth = window.speechSynthesis;
    this.settings = {
      rate: settings.rate ?? 1,
      pitch: settings.pitch ?? 1,
      volume: settings.volume ?? 1,
      enabled: settings.enabled ?? false,
      voice: settings.voice,
    };
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synth.getVoices();
  }

  /**
   * Set TTS settings
   */
  setSettings(newSettings: Partial<TTSSettings>) {
    this.settings = { ...this.settings, ...newSettings };

    // If currently playing, cancel and restart with new settings
    if (this.isPlaying) {
      this.stop();
    }
  }

  /**
   * Speak the given word
   */
  speak(token: TextToken) {
    if (!this.settings.enabled) return;

    // Cancel any ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(token.word);
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;
    utterance.volume = this.settings.volume;

    if (this.settings.voice) {
      utterance.voice = this.settings.voice;
    }

    utterance.onstart = () => {
      this.isPlaying = true;
    };

    utterance.onend = () => {
      this.isPlaying = false;
    };

    utterance.onerror = (event) => {
      console.error('TTS error:', event.error);
      this.isPlaying = false;
    };

    // utterance tracking
    this.synth.speak(utterance);
  }

  /**
   * Speak a full sentence or paragraph
   */
  speakText(text: string) {
    if (!this.settings.enabled) return;

    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;
    utterance.volume = this.settings.volume;

    if (this.settings.voice) {
      utterance.voice = this.settings.voice;
    }

    utterance.onstart = () => {
      this.isPlaying = true;
    };

    utterance.onend = () => {
      this.isPlaying = false;
    };

    // utterance tracking
    this.synth.speak(utterance);
  }

  /**
   * Pause speech
   */
  pause() {
    if (this.synth.speaking && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
    }
  }

  /**
   * Resume paused speech
   */
  resume() {
    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  /**
   * Stop all speech
   */
  stop() {
    this.synth.cancel();
    this.isPlaying = false;
    this.isPaused = false;
    // utterance cleared
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.isPlaying;
  }

  /**
   * Check if paused
   */
  isCurrentlyPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Enable/disable TTS
   */
  setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  /**
   * Set voice by index or name
   */
  setVoice(voiceOrIndex: SpeechSynthesisVoice | number) {
    if (typeof voiceOrIndex === 'number') {
      const voices = this.getAvailableVoices();
      this.settings.voice = voices[voiceOrIndex];
    } else {
      this.settings.voice = voiceOrIndex;
    }
  }
}



