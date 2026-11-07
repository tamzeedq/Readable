import type { CSSProperties } from 'react';
import type { Book } from '../../types';
import { useCoverUrl } from '../../lib/bookStorage';
import './Cover.css';

interface CoverProps {
  book: Pick<Book, 'id' | 'title' | 'author' | 'hasCover' | 'coverHue'>;
  /** Fixed width in px; omit to fill the parent (aspect 2:3 is kept) */
  width?: number;
  /** Typographic cover title size (px). Defaults scale with width. */
  titleSize?: number;
  authorSize?: number;
  /** Hero covers use larger radii and inset */
  variant?: 'tile' | 'hero';
  className?: string;
  style?: CSSProperties;
}

/**
 * Book cover: stored cover image if present, otherwise the generated typographic cover
 * (solid oklch(L 0.07 hue), inset border, title + uppercase author, spine shading).
 */
export function Cover({ book, width, titleSize, authorSize, variant = 'tile', className, style }: CoverProps) {
  const url = useCoverUrl(book.id, book.hasCover);
  const w = width ?? 120;
  const tSize = titleSize ?? Math.max(9, Math.round(w * 0.125));
  const aSize = authorSize ?? Math.max(6, Math.round(w * 0.066));
  const inset = variant === 'hero' ? 10 : Math.max(3, Math.round(w * 0.058));
  // Shrink the title so its longest word fits on one line (avoids "Middlemar|ch")
  const padX = Math.round(inset * 0.6);
  const available = w - 2 * inset - 2 * padX - 2;
  const longest = Math.max(...book.title.split(/\s+/).map((s) => s.length), 1);
  const fittedTitle = Math.min(tSize, Math.floor(available / (longest * 0.56)));

  return (
    <div
      className={`cover cover-${variant} ${className ?? ''}`}
      style={{
        width,
        background: url ? 'var(--chip)' : `oklch(var(--cover-l) 0.07 ${book.coverHue})`,
        ...style,
      }}
      role="img"
      aria-label={`${book.title} cover`}
    >
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <div className="cover-type" style={{ inset, padding: `${Math.round(inset * 2)}px ${padX}px ${Math.round(inset * 1.3)}px` }}>
          <span className="cover-title" style={{ fontSize: Math.max(8, fittedTitle) }}>
            {book.title}
          </span>
          <span className="cover-author" style={{ fontSize: aSize }}>
            {book.author}
          </span>
        </div>
      )}
      <div className="cover-spine" />
    </div>
  );
}

/** Thin coloured spine used in shelves, import rows and search results */
export function Spine({
  hue,
  width,
  height,
  title,
  dashed,
}: {
  hue: number;
  width: number;
  height: number;
  title?: string;
  dashed?: boolean;
}) {
  return (
    <div
      className={`spine ${dashed ? 'spine-dashed' : ''}`}
      style={{
        width,
        height,
        background: dashed ? 'transparent' : `oklch(var(--cover-l) 0.07 ${hue})`,
      }}
      aria-hidden="true"
    >
      {title && <span>{title}</span>}
    </div>
  );
}
