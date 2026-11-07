import { useState } from 'react';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { Book } from '../../types';
import { ShelfMenu } from './ShelfMenu';
import { usePopover } from './Popover';
import { ConfirmRemoveBook } from './ConfirmDialog';

/**
 * Edit details · Add to shelf · Remove — used on the grid hover overlay (light-on-dark buttons)
 * and in list/compact rows. `onBusyChange` lets the parent keep its hover state while a menu/dialog is open.
 */
export function BookActions({
  book,
  variant,
  onBusyChange,
}: {
  book: Book;
  variant: 'overlay' | 'row';
  onBusyChange?: (busy: boolean) => void;
}) {
  const openOverlay = useAppStore((s) => s.openOverlay);
  const shelf = usePopover();
  const [confirming, setConfirming] = useState(false);
  const cls = variant === 'overlay' ? 'lib-ov-icon' : 'icon-btn lib-row-icon';
  const size = 16;

  const setShelfOpen = (o: boolean) => {
    shelf.setOpen(o);
    onBusyChange?.(o);
  };
  const setConfirm = (o: boolean) => {
    setConfirming(o);
    onBusyChange?.(o);
  };

  return (
    <>
      <button
        type="button"
        className={cls}
        aria-label={`Edit details of ${book.title}`}
        title="Edit details"
        onClick={(e) => {
          e.stopPropagation();
          openOverlay('details', book.id);
        }}
      >
        <Pencil size={size} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <button
        type="button"
        ref={shelf.anchorRef}
        className={cls}
        aria-label={`Add ${book.title} to shelf`}
        aria-haspopup="menu"
        aria-expanded={shelf.open}
        title="Add to shelf"
        onClick={(e) => {
          e.stopPropagation();
          setShelfOpen(!shelf.open);
        }}
      >
        <FolderPlus size={size} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={cls}
        aria-label={`Remove ${book.title} from library`}
        title="Remove"
        onClick={(e) => {
          e.stopPropagation();
          setConfirm(true);
        }}
      >
        <Trash2 size={size} strokeWidth={1.6} aria-hidden="true" />
      </button>
      {shelf.open && (
        <ShelfMenu
          book={book}
          anchorRef={shelf.anchorRef}
          onClose={() => setShelfOpen(false)}
          align={variant === 'row' ? 'end' : 'start'}
        />
      )}
      {confirming && (
        // The dialog is portalled, but React events still bubble to the tile — stop them here.
        <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ConfirmRemoveBook book={book} onClose={() => setConfirm(false)} />
        </div>
      )}
    </>
  );
}
