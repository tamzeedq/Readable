import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import './shared.css';

const ITEM_SELECTOR =
  '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled), [role="menuitemradio"]:not(:disabled), input';

/**
 * Small anchored menu, portalled to <body> with fixed positioning so it isn't clipped by
 * covers or scroll containers. Closes on outside click, scroll, resize and Esc
 * (Esc is stopped here so it doesn't also close the drawer/overlay underneath).
 */
export function Popover({
  anchorRef,
  onClose,
  children,
  align = 'start',
  label,
  minWidth = 200,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  align?: 'start' | 'end';
  label: string;
  minWidth?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const a = anchorRef.current;
    const p = ref.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;
    let left = align === 'end' ? r.right - pw : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    setPos({ top, left });
  }, [anchorRef, align]);

  useEffect(() => {
    const inside = (t: EventTarget | null) =>
      t instanceof Node && (ref.current?.contains(t) || anchorRef.current?.contains(t));
    const onDown = (e: Event) => {
      if (!inside(e.target)) closeRef.current();
    };
    const onScroll = (e: Event) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) closeRef.current();
    };
    const onResize = () => closeRef.current();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    ref.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [anchorRef]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      anchorRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      onClose();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  return createPortal(
    <div
      ref={ref}
      className="bk-popover"
      role="menu"
      aria-label={label}
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, minWidth, visibility: pos ? 'visible' : 'hidden' }}
      onKeyDown={onKeyDown}
      // Portal events bubble through the React tree — keep clicks from reaching tiles/cards.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({
  children,
  onSelect,
  checked,
  danger,
  disabled,
  icon,
}: {
  children: ReactNode;
  onSelect: () => void;
  /** When defined the item renders as a checkable option with a check slot */
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const checkable = checked !== undefined;
  return (
    <button
      type="button"
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkable ? checked : undefined}
      className={`bk-menu-item ${danger ? 'is-danger' : ''}`}
      disabled={disabled}
      onClick={onSelect}
    >
      {checkable && (
        <span className="bk-menu-check" aria-hidden="true">
          {checked && <Check size={15} strokeWidth={2} />}
        </span>
      )}
      {icon && (
        <span className="bk-menu-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="bk-menu-label">{children}</span>
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="bk-menu-heading">{children}</div>;
}

export function MenuDivider() {
  return <div className="bk-menu-divider" role="separator" />;
}

/** Convenience: a ref + open state pair for an anchored popover */
export function usePopover<T extends HTMLElement = HTMLButtonElement>() {
  const anchorRef = useRef<T>(null);
  const [open, setOpen] = useState(false);
  return { anchorRef, open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}
