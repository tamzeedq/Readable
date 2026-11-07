import { useEffect, useState } from 'react';
import type { BookImage } from '../types';
import { ImageIcon, PlayIcon } from './icons';

/** Screen 12: replaces the word stage when playback reaches a figure. */
export function ImagePause({
  image,
  mobile,
  onContinue,
  onSkip,
}: {
  image: BookImage;
  mobile: boolean;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(image.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image]);

  return (
    <>
      <figure className={mobile ? 'rd-figure rd-figure-m' : 'rd-figure'} onClick={(e) => e.stopPropagation()}>
        <div className="rd-figure-frame">{url && <img src={url} alt={image.alt || image.caption || 'Illustration'} />}</div>
        {image.caption && <figcaption>{image.caption}</figcaption>}
      </figure>
      {mobile ? (
        <div className="rd-imgbar-m" onClick={(e) => e.stopPropagation()}>
          <span className="rd-imgbar-label">
            <ImageIcon />
            Paused at an image
          </span>
          <div className="rd-imgbar-m-btns">
            <button type="button" className="rd-btn-secondary" onClick={onSkip}>
              Skip images
            </button>
            <button type="button" className="rd-btn-primary" onClick={onContinue}>
              <PlayIcon size={14} />
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="rd-imgbar" onClick={(e) => e.stopPropagation()}>
          <span className="rd-imgbar-label">
            <ImageIcon />
            Paused at an image
          </span>
          <button type="button" className="rd-btn-secondary" onClick={onSkip}>
            Skip images in this book
          </button>
          <button type="button" className="rd-btn-primary" onClick={onContinue}>
            Continue<kbd className="rd-kbd-on-accent">Space</kbd>
          </button>
        </div>
      )}
    </>
  );
}
