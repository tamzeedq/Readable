import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../ui/Overlay';
import { useAppStore } from '../../store/appStore';

/** Small "New shelf" prompt used by the sidebar and Collections. */
export function NewShelfDialog({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const addShelf = useAppStore((s) => s.addShelf);
  const [name, setName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const shelf = addShelf(trimmed);
    onCreated?.(shelf.id);
    onClose();
  };

  return (
    <Modal onClose={onClose} label="New shelf" style={{ width: 'min(420px, calc(100vw - 32px))' }}>
      <form onSubmit={submit} style={{ padding: '22px 24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 500 }}>New shelf</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.6} />
          </button>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow">Name</span>
          <input
            className="field"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Poetry"
            style={{ fontSize: 18 }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Create shelf
          </button>
        </div>
      </form>
    </Modal>
  );
}
