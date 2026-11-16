import { X } from 'lucide-react';
import { Modal, Sheet } from '../components/ui/Overlay';
import { MOD_KEY_LABEL } from '../components/shell/Sidebar';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAppStore } from '../store/appStore';
import './ShortcutsHelp.css';

export interface ShortcutItem {
  keys: string[];
  label: string;
}

export const READER_SHORTCUTS: ShortcutItem[] = [
  { keys: ['Space'], label: 'Play or pause' },
  { keys: ['←', '→'], label: 'Previous or next word' },
  { keys: ['↑', '+'], label: 'Faster' },
  { keys: ['↓', '−'], label: 'Slower' },
  { keys: ['Esc'], label: 'Pause, or close a panel' },
];

export const GLOBAL_SHORTCUTS: ShortcutItem[] = [
  { keys: [MOD_KEY_LABEL], label: 'Search books and actions' },
  { keys: ['?'], label: 'Show this list' },
  { keys: ['Esc'], label: 'Close search or a dialog' },
];

export const MOBILE_GESTURES: ShortcutItem[] = [
  { keys: ['Tap'], label: 'Play or pause; show the controls' },
  { keys: ['Prev / next'], label: 'Step by word or sentence with the buttons below the word' },
  { keys: ['− / +'], label: 'Change speed in 25 wpm steps' },
  { keys: ['Pause'], label: 'Shows the surrounding text so you can find your place' },
];

function Group({ title, items }: { title: string; items: ShortcutItem[] }) {
  return (
    <section className="sh-group">
      <h3 className="sh-group-title">{title}</h3>
      <dl className="sh-list">
        {items.map((it) => (
          <div key={it.label} className="sh-row">
            <dt>{it.label}</dt>
            <dd>
              {it.keys.map((k, i) => (
                <span key={k}>
                  {i > 0 && <span className="sh-or"> / </span>}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** `?` overlay: keyboard shortcuts on desktop, gestures and controls on mobile. */
export function ShortcutsHelp() {
  const close = useAppStore((s) => s.closeOverlay);
  const mobile = useIsMobile();

  const body = mobile ? (
    <>
      <Group title="Reading on touch" items={MOBILE_GESTURES} />
    </>
  ) : (
    <div className="sh-cols">
      <Group title="Reader" items={READER_SHORTCUTS} />
      <Group title="Anywhere" items={GLOBAL_SHORTCUTS} />
    </div>
  );

  const content = (
    <div className="sh">
      <header className="sh-head">
        <h2 className="sh-title">{mobile ? 'Controls' : 'Keyboard shortcuts'}</h2>
        <button type="button" className="sh-close" aria-label="Close" onClick={close}>
          <X size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </header>
      {body}
    </div>
  );

  return mobile ? (
    <Sheet onClose={close} label="Controls">
      {content}
    </Sheet>
  ) : (
    <Modal onClose={close} label="Keyboard shortcuts" className="sh-modal">
      {content}
    </Modal>
  );
}
