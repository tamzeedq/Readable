import React, { useEffect, useRef, useState } from 'react';
import { TextToken, ContentBlock } from '../types';
import { PlaybackState } from '../lib/engine';
import { useAppStore } from '../store/appStore';
import './FocusReader.css';

interface FocusReaderProps {
  currentToken: TextToken | null;
  currentBlock: ContentBlock | null;
  playbackState: PlaybackState;
  onImageBlockReached: (block: ContentBlock) => void;
}

/**
 * Main focus reading component
 * Displays the current word with bolded focal characters
 * Provides a centered, distraction-free reading experience
 */
export const FocusReader: React.FC<FocusReaderProps> = ({
  currentToken,
  currentBlock,
  playbackState,
  onImageBlockReached,
}) => {
  const { playbackSettings, darkMode } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayWord, setDisplayWord] = useState('');

  // Handle focal letter bolding
  useEffect(() => {
    if (!currentToken) {
      setDisplayWord('');
      return;
    }

    const word = currentToken.word;
    const charIndex = currentToken.charIndex;

    // Create display with focal character bolded
    const before = word.substring(0, charIndex);
    const focal = word[charIndex];
    const after = word.substring(charIndex + 1);

    setDisplayWord(`${before}<strong>${focal}</strong>${after}`);
  }, [currentToken]);

  // Handle image blocks
  useEffect(() => {
    if (currentBlock?.type === 'image') {
      onImageBlockReached(currentBlock);
    }
  }, [currentBlock, onImageBlockReached]);

  const containerStyles: React.CSSProperties = {
    backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
    color: darkMode ? '#ffffff' : '#000000',
    fontSize: `${playbackSettings.fontSize}px`,
    fontFamily: playbackSettings.dyslexiaFriendlyFont
      ? '"OpenDyslexic", sans-serif'
      : playbackSettings.fontFamily,
    lineHeight: playbackSettings.focusLineHeight,
    filter: playbackSettings.highContrast ? 'contrast(1.5)' : 'none',
  };

  return (
    <div
      ref={containerRef}
      className="focus-reader-container"
      style={containerStyles}
      role="region"
      aria-label="Focus reading window"
      aria-live="polite"
    >
      <div className="focus-reader-wrapper">
        <div className="focus-reader-display" role="main">
          {currentToken ? (
            <div
              className="focus-word"
              dangerouslySetInnerHTML={{
                __html: displayWord + (currentToken.punctuation || ''),
              }}
              style={{
                fontWeight: playbackSettings.focalLetterBoldness,
              }}
            />
          ) : (
            <div className="focus-placeholder">
              {playbackState.isPlaying ? 'Playing...' : 'Select a book to start reading'}
            </div>
          )}
        </div>

        {/* Progress indicator */}
        <div className="focus-reader-progress" aria-label="Reading progress">
          <div className="progress-text">
            {playbackState.currentTokenIndex + 1} / {playbackState.wordsPerMinute} WPM
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${((playbackState.currentTokenIndex) / playbackState.wordsPerMinute) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusReader;
