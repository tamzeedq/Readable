import { useState } from 'react';
import { Clipboard, Plus } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { addSampleBooks } from '../../lib/samples';
import './shared.css';

/** First-run empty state: shown in place of the Continue-reading hero and the empty Library. */
export function WelcomeCard({
  eyebrow = 'Welcome',
  title = 'A quieter way through your reading',
  mobile = false,
}: {
  eyebrow?: string;
  title?: string;
  mobile?: boolean;
}) {
  const openOverlay = useAppStore((s) => s.openOverlay);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  const addSamples = async () => {
    setAdding(true);
    setFailed(false);
    try {
      await addSampleBooks();
    } catch {
      setFailed(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className={`bk-welcome ${mobile ? 'is-mobile' : ''}`} aria-label={eyebrow}>
      <div className="bk-welcome-art" aria-hidden="true">
        <span className="bk-welcome-ghost">quietly</span>
        <span className="bk-welcome-word">
          r<b>e</b>ad
        </span>
        <span className="bk-welcome-ghost">one</span>
      </div>
      <div className="bk-welcome-text">
        <div className="bk-welcome-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>
          Readable shows a book one word at a time, at a pace you choose, so your eyes stay still and
          the words come to you. Add an EPUB, PDF or text file to begin.
        </p>
        <div className="bk-welcome-actions">
          <button type="button" className={`btn btn-primary ${mobile ? '' : 'btn-lg'}`} onClick={() => openOverlay('import')}>
            <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
            Add books
          </button>
          <button type="button" className={`btn ${mobile ? '' : 'btn-lg'}`} onClick={() => openOverlay('paste')}>
            <Clipboard size={17} strokeWidth={1.6} aria-hidden="true" />
            Paste text
          </button>
        </div>
        <button type="button" className="btn btn-text bk-welcome-sample" onClick={addSamples} disabled={adding}>
          {adding ? 'Adding sample books…' : failed ? 'Couldn’t add samples — try again' : 'Or add a few sample books'}
        </button>
      </div>
    </section>
  );
}
