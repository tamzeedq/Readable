import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared overlay shell: scrim + panel, focus moved into the panel on open and
 * restored on close, Tab kept inside. Esc is handled globally (App) via closeOverlay,
 * but `onClose` is also called for Esc here so overlays work standalone.
 */
function OverlayShell({
  onClose,
  panelClass,
  scrimClass,
  label,
  children,
  style,
}: {
  onClose: () => void;
  panelClass: string;
  scrimClass?: string;
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Captured during the first render, before any child's autoFocus can move focus into the panel
  const [previouslyFocused] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel?.contains(document.activeElement)) {
      const first = panel?.querySelector<HTMLElement>(
        '[autofocus], input, textarea, button, [href], select, [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panel)?.focus();
    }
    return () => previouslyFocused?.focus?.();
  }, [previouslyFocused]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'input, textarea, button:not(:disabled), [href], select, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div onKeyDown={onKeyDown}>
      <div className={`scrim ${scrimClass ?? ''}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={style}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Modal(props: {
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  scrimClass?: string;
}) {
  return (
    <OverlayShell
      onClose={props.onClose}
      label={props.label}
      panelClass={`modal ${props.className ?? ''}`}
      scrimClass={props.scrimClass}
      style={props.style}
    >
      {props.children}
    </OverlayShell>
  );
}

export function Drawer(props: { onClose: () => void; label: string; children: ReactNode; className?: string }) {
  return (
    <OverlayShell onClose={props.onClose} label={props.label} panelClass={`drawer ${props.className ?? ''}`}>
      {props.children}
    </OverlayShell>
  );
}

/** Mobile bottom sheet. `top` is the distance from the top of the screen (64 import, 96 details). */
export function Sheet(props: {
  onClose: () => void;
  label: string;
  children: ReactNode;
  top?: number;
  lightScrim?: boolean;
  className?: string;
}) {
  const startY = useRef<number | null>(null);
  return (
    <OverlayShell
      onClose={props.onClose}
      label={props.label}
      panelClass={`sheet ${props.className ?? ''}`}
      scrimClass={props.lightScrim ? 'light' : undefined}
      style={props.top !== undefined ? { top: props.top, maxHeight: 'none' } : undefined}
    >
      {/* Swipe-down on the grabber dismisses */}
      <div
        className="sheet-grabber-hit"
        style={{ padding: '4px 0', touchAction: 'none', cursor: 'grab' }}
        onPointerDown={(e) => {
          startY.current = e.clientY;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (startY.current !== null && e.clientY - startY.current > 60) props.onClose();
          startY.current = null;
        }}
      >
        <div className="sheet-grabber" />
      </div>
      {props.children}
    </OverlayShell>
  );
}
