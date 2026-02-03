import React, { useState } from 'react';
import { PlaybackState } from '../lib/engine';
import './PlaybackControls.css';

interface PlaybackControlsProps {
  state: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onWPMChange: (wpm: number) => void;
  onSeek: (tokenIndex: number) => void;
  totalTokens: number;
  enableTTS?: boolean;
  onTTSToggle?: (enabled: boolean) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  state,
  onPlay,
  onPause,
  onResume,
  onStop,
  onWPMChange,
  onSeek,
  totalTokens,
  enableTTS = false,
  onTTSToggle,
}) => {
  const [wpmInput, setWpmInput] = useState(state.wordsPerMinute.toString());

  const handleWPMChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setWpmInput(e.target.value);
    if (value >= 50 && value <= 1000) {
      onWPMChange(value);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value) || 0;
    onSeek(newIndex);
  };

  const progress = ((state.currentTokenIndex / totalTokens) * 100) || 0;

  return (
    <div className="playback-controls">
      <div className="controls-row">
        {/* Play/Pause/Resume/Stop buttons */}
        <div className="control-buttons">
          {!state.isPlaying && !state.isPaused ? (
            <button
              onClick={onPlay}
              className="btn btn-primary"
              aria-label="Play"
              title="Start reading (Space)"
            >
              <span className="btn-icon">▶</span>
              Play
            </button>
          ) : state.isPlaying ? (
            <button
              onClick={onPause}
              className="btn btn-primary"
              aria-label="Pause"
              title="Pause (Space)"
            >
              <span className="btn-icon">⏸</span>
              Pause
            </button>
          ) : (
            <button
              onClick={onResume}
              className="btn btn-primary"
              aria-label="Resume"
              title="Resume (Space)"
            >
              <span className="btn-icon">▶</span>
              Resume
            </button>
          )}

          <button
            onClick={onStop}
            className="btn btn-secondary"
            aria-label="Stop"
            title="Stop"
          >
            <span className="btn-icon">⏹</span>
            Stop
          </button>

          {onTTSToggle && (
            <button
              onClick={() => onTTSToggle(!enableTTS)}
              className={`btn ${enableTTS ? 'btn-active' : 'btn-secondary'}`}
              aria-label={`Text-to-speech ${enableTTS ? 'on' : 'off'}`}
              title="Toggle TTS"
            >
              <span className="btn-icon">🔊</span>
              TTS
            </button>
          )}
        </div>
      </div>

      {/* WPM Slider */}
      <div className="controls-row">
        <label htmlFor="wpm-slider" className="control-label">
          Speed (WPM):
        </label>
        <input
          id="wpm-slider"
          type="range"
          min="50"
          max="1000"
          step="10"
          value={state.wordsPerMinute}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            setWpmInput(value.toString());
            onWPMChange(value);
          }}
          className="control-slider"
          aria-label="Words per minute"
          title="Adjust reading speed"
        />
        <input
          type="number"
          min="50"
          max="1000"
          step="10"
          value={wpmInput}
          onChange={handleWPMChange}
          className="control-input-number"
          aria-label="Words per minute input"
        />
        <span className="control-value">{state.wordsPerMinute} WPM</span>
      </div>

      {/* Progress slider */}
      <div className="controls-row">
        <label htmlFor="progress-slider" className="control-label">
          Progress:
        </label>
        <input
          id="progress-slider"
          type="range"
          min="0"
          max={totalTokens - 1}
          value={state.currentTokenIndex}
          onChange={handleProgressChange}
          className="control-slider"
          aria-label="Reading progress"
          title="Seek to position"
        />
        <span className="control-value">
          {state.currentTokenIndex + 1} / {totalTokens} words
        </span>
      </div>

      {/* Visual progress bar */}
      <div className="progress-track">
        <div
          className="progress-indicator"
          style={{
            width: `${progress}%`,
          }}
          aria-hidden="true"
        />
      </div>

      {/* Keyboard hints */}
      <div className="keyboard-hints">
        <small>
          Keyboard: <kbd>Space</kbd> Play/Pause • <kbd>←/→</kbd> Seek • <kbd>+/-</kbd> Speed
        </small>
      </div>
    </div>
  );
};

export default PlaybackControls;
