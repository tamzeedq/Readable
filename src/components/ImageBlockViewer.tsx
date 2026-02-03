import React, { useState, useEffect } from 'react';
import { ContentBlock } from '../types';
import './ImageBlockViewer.css';

interface ImageBlockViewerProps {
  block: ContentBlock | null;
  isVisible: boolean;
  onResume: () => void;
  duration?: number; // auto-resume after duration (ms)
}

export const ImageBlockViewer: React.FC<ImageBlockViewerProps> = ({
  block,
  isVisible,
  onResume,
  duration = 0,
}) => {
  const [autoResumeCountdown, setAutoResumeCountdown] = useState(0);

  useEffect(() => {
    if (!isVisible || duration <= 0) return;

    setAutoResumeCountdown(duration / 1000); // convert to seconds

    const interval = setInterval(() => {
      setAutoResumeCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onResume();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, duration, onResume]);

  if (!isVisible || !block || block.type !== 'image') {
    return null;
  }

  const imageData = block.content as any;

  return (
    <div className="image-block-viewer" role="region" aria-label="Image block">
      <div className="image-block-overlay">
        <div className="image-block-content">
          <div className="image-block-frame">
            {imageData.url ? (
              <img src={imageData.url} alt={imageData.alt} className="image-block-img" />
            ) : (
              <div className="image-block-placeholder">
                <span className="placeholder-icon">🖼</span>
                <p>{imageData.alt || 'Image'}</p>
              </div>
            )}
          </div>

          {imageData.caption && (
            <p className="image-block-caption">{imageData.caption}</p>
          )}

          {imageData.alt && !imageData.caption && (
            <p className="image-block-alt">{imageData.alt}</p>
          )}

          <div className="image-block-controls">
            <button
              onClick={onResume}
              className="btn-continue"
              aria-label="Resume reading"
            >
              Continue Reading →
            </button>

            {duration > 0 && autoResumeCountdown > 0 && (
              <p className="auto-resume-hint">
                Auto-resuming in {Math.ceil(autoResumeCountdown)}s...
              </p>
            )}
          </div>

          {/* Accessibility: Screen reader helper */}
          <div className="sr-only">
            Image: {imageData.alt}. {imageData.caption ? `Caption: ${imageData.caption}` : ''}
            Press Continue Reading to resume.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageBlockViewer;
