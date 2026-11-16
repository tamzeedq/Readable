import { Fragment, type ReactNode } from 'react';
import privacyMd from '../../../docs/legal/privacy.md?raw';
import termsMd from '../../../docs/legal/terms.md?raw';

export type LegalDoc = 'privacy' | 'terms';
const DOCS: Record<LegalDoc, string> = { privacy: privacyMd, terms: termsMd };

/** Minimal markdown: #/## headings, > notes, - lists, paragraphs, **bold**, _italic_. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith('_') && part.endsWith('_') && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function renderMarkdown(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('- ')) { list.push(line.slice(2)); continue; }
    flush();
    if (!line) continue;
    if (line.startsWith('## ')) out.push(<h3 key={out.length}>{line.slice(3)}</h3>);
    else if (line.startsWith('# ')) out.push(<h2 key={out.length}>{line.slice(2)}</h2>);
    else if (line.startsWith('> ')) out.push(<p key={out.length} role="note" style={{ padding: 12, border: '1px solid currentColor', borderRadius: 8 }}>{inline(line.slice(2))}</p>);
    else out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return out;
}

export function LegalDocument({ doc, onBack }: { doc: LegalDoc; onBack: () => void }) {
  return (
    <article aria-label={doc === 'privacy' ? 'Privacy policy' : 'Terms of use'} style={{ maxWidth: 640, lineHeight: 1.6 }}>
      <button type="button" className="btn btn-text" style={{ padding: 0, height: 'auto', marginBottom: 12 }} onClick={onBack}>
        ← Back
      </button>
      {renderMarkdown(DOCS[doc])}
    </article>
  );
}

export function LegalLinks({ onOpen, prefix }: { onOpen: (d: LegalDoc) => void; prefix?: string }) {
  const link = (d: LegalDoc, label: string) => (
    <button type="button" className="btn btn-text" style={{ padding: 0, height: 'auto', textDecoration: 'underline' }} onClick={() => onOpen(d)}>
      {label}
    </button>
  );
  return (
    <span className="set-row-desc">
      {prefix}
      {link('terms', 'Terms')} · {link('privacy', 'Privacy policy')}
    </span>
  );
}
