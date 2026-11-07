import { useAppStore } from '../../store/appStore';
import type { Book } from '../../types';
import { MenuItem, MenuLabel, Popover } from './Popover';

/** Popover listing every shelf with a checkmark; selecting toggles the book on/off that shelf. */
export function ShelfMenu({
  book,
  anchorRef,
  onClose,
  align,
}: {
  book: Book;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  align?: 'start' | 'end';
}) {
  const shelves = useAppStore((s) => s.shelves);
  const toggleBookShelf = useAppStore((s) => s.toggleBookShelf);
  return (
    <Popover anchorRef={anchorRef} onClose={onClose} label="Add to shelf" align={align}>
      <MenuLabel>Shelves</MenuLabel>
      {shelves.length === 0 && <div className="bk-menu-empty">No shelves yet — create one from Collections.</div>}
      {shelves.map((sh) => (
        <MenuItem key={sh.id} checked={book.shelves.includes(sh.id)} onSelect={() => toggleBookShelf(book.id, sh.id)}>
          <span className="bk-shelf-tab" style={{ background: sh.color }} aria-hidden="true" />
          {sh.name}
        </MenuItem>
      ))}
    </Popover>
  );
}
