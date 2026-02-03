import { TextToken, ContentBlock } from '../types';

export interface PlaybackState {
  currentTokenIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  wordsPerMinute: number;
  currentBlock: ContentBlock | null;
}

export interface PlaybackEngineCallbacks {
  onTokenChange: (token: TextToken | null, blockIndex: number) => void;
  onPlayStateChange: (state: PlaybackState) => void;
  onBlockChange: (block: ContentBlock | null, blockIndex: number) => void;
  onComplete: () => void;
}

export class ReadingEngine {
  private tokens: TextToken[];
  private blocks: ContentBlock[];
  private currentTokenIndex: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private wordsPerMinute: number = 300;
  private playbackTimer: NodeJS.Timeout | null = null;
  private callbacks: PlaybackEngineCallbacks;

  constructor(
    tokens: TextToken[],
    blocks: ContentBlock[],
    callbacks: PlaybackEngineCallbacks
  ) {
    this.tokens = tokens;
    this.blocks = blocks;
    this.callbacks = callbacks;
  }

  private getCurrentBlock(): ContentBlock | null {
    if (this.currentTokenIndex >= this.tokens.length) return null;
    const token = this.tokens[this.currentTokenIndex];
    return this.blocks[token.blockIndex] || null;
  }

  private emitStateChange() {
    this.callbacks.onPlayStateChange({
      currentTokenIndex: this.currentTokenIndex,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      wordsPerMinute: this.wordsPerMinute,
      currentBlock: this.getCurrentBlock(),
    });
  }

  play() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.emitStateChange();
    this.startPlayback();
  }

  pause() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.isPaused = true;
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.emitStateChange();
  }

  resume() {
    if (this.isPaused) {
      this.play();
    }
  }

  stop() {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTokenIndex = 0;
    this.emitStateChange();
    this.callbacks.onTokenChange(null, 0);
  }

  private startPlayback() {
    const scheduleNext = () => {
      if (!this.isPlaying) return;

      // Check if we've hit an image block, auto-pause
      const token = this.tokens[this.currentTokenIndex];
      if (token) {
        const block = this.blocks[token.blockIndex];
        if (block?.type === 'image') {
          this.pause();
          this.callbacks.onBlockChange(block, token.blockIndex);
          return;
        }
      }

      // Emit current token
      if (this.currentTokenIndex < this.tokens.length) {
        const token = this.tokens[this.currentTokenIndex];
        this.callbacks.onTokenChange(token, token.blockIndex);
        this.currentTokenIndex++;
      } else {
        // End of content
        this.isPlaying = false;
        this.callbacks.onComplete();
        this.emitStateChange();
        return;
      }

      // Calculate delay in ms: 60,000ms / (WPM * avg words shown per token)
      // We show one word at a time, so delay = 60,000 / WPM
      const delayMs = (60 * 1000) / this.wordsPerMinute;

      this.emitStateChange();
      this.playbackTimer = setTimeout(scheduleNext, delayMs);
    };

    scheduleNext();
  }

  setWordsPerMinute(wpm: number) {
    this.wordsPerMinute = Math.max(50, Math.min(1000, wpm));
    if (this.isPlaying) {
      // Restart playback with new timing
      if (this.playbackTimer) {
        clearTimeout(this.playbackTimer);
        this.playbackTimer = null;
      }
      this.startPlayback();
    }
  }

  seek(tokenIndex: number) {
    this.currentTokenIndex = Math.max(0, Math.min(tokenIndex, this.tokens.length - 1));
    this.callbacks.onTokenChange(
      this.tokens[this.currentTokenIndex] || null,
      this.tokens[this.currentTokenIndex]?.blockIndex || 0
    );
    this.emitStateChange();
  }

  getState(): PlaybackState {
    return {
      currentTokenIndex: this.currentTokenIndex,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      wordsPerMinute: this.wordsPerMinute,
      currentBlock: this.getCurrentBlock(),
    };
  }

  getTotalTokens(): number {
    return this.tokens.length;
  }

  getCurrentTokenIndex(): number {
    return this.currentTokenIndex;
  }
}
