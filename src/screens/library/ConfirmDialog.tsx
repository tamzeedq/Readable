import type { ReactNode } from 'react';
import { Modal } from '../../components/ui/Overlay';
import { useAppStore } from '../../store/appStore';
import type { Book } from '../../types';
import './shared.css';

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} label={title} className="bk-confirm">
      <div className="bk-confirm-body">
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      <div className="bk-confirm-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function ConfirmRemoveBook({ book, onClose }: { book: Book; onClose: () => void }) {
  const removeBook = useAppStore((s) => s.removeBook);
  return (
    <ConfirmDialog
      title="Remove from library?"
      confirmLabel="Remove"
      onConfirm={() => removeBook(book.id)}
      onClose={onClose}
    >
      <em>{book.title}</em> and its reading progress, bookmarks and cover will be deleted from this
      device.
    </ConfirmDialog>
  );
}
