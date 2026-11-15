import { useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Modal, Sheet } from '../components/ui/Overlay';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAppStore } from '../store/appStore';
import { addSampleBooks } from '../lib/samples';
import { ReaderEngine, defaultEngineConfig } from '../reader/engine';
import { WordStage, type StageLook } from '../reader/WordStage';
import { useEngine, selPlaying } from '../reader/useReader';
import '../reader/reader.css';
import './Onboarding.css';

const DEMO_TEXT =
  'Reading is mostly your eyes travelling. Here the words come to you, one at a time, while your eyes rest in one place.';

const PACES = [
  { name: 'Gentle', wpm: 200 },
  { name: 'Comfortable', wpm: 320 },
  { name: 'Brisk', wpm: 450 },
] as const;

const STEPS = 3;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A real ReaderEngine + WordStage looping over a short passage. */
function MiniDemo({ wpm, guides, mobile }: { wpm: number; guides: boolean; mobile: boolean }) {
  const engine = useMemo(() => {
    const words = DEMO_TEXT.split(/\s+/);
    return new ReaderEngine({ words, paragraphStarts: [0], images: [] }, 0, wpm, {
      ...defaultEngineConfig,
      pauseAtImages: false,
    });
    // created once; wpm changes are applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const playing = useEngine(engine, selPlaying);

  useEffect(() => {
    engine.setWpm(wpm);
  }, [engine, wpm]);

  useEffect(() => {
    if (!prefersReducedMotion()) engine.play();
    const unsub = engine.subscribe(() => {
      if (engine.getState().finished) {
        engine.seek(0);
        engine.play();
      }
    });
    return () => {
      unsub();
      engine.dispose();
    };
  }, [engine]);

  const look: StageLook = { size: mobile ? 44 : 56, ghostCount: 0, guides, bionic: false, mobile };

  return (
    <div className="ob-demo">
      <div className="ob-demo-stage" data-testid="onboarding-demo">
        <WordStage engine={engine} look={look} />
      </div>
      <button
        type="button"
        className="ob-demo-toggle"
        aria-label={playing ? 'Pause the demo' : 'Play the demo'}
        onClick={() => engine.toggle()}
      >
        {playing ? <Pause size={15} strokeWidth={1.8} aria-hidden="true" /> : <Play size={15} strokeWidth={1.8} aria-hidden="true" />}
      </button>
    </div>
  );
}

/** First-run intro: three calm steps, a live demo, a comfortable starting speed. */
export function Onboarding() {
  const mobile = useIsMobile();
  const close = useAppStore((s) => s.closeOverlay);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const wpm = useAppStore((s) => s.readingPrefs.defaultWpm);
  const setReadingPrefs = useAppStore((s) => s.setReadingPrefs);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Shown once: any way of leaving (including Esc or the scrim) counts as seen.
  useEffect(() => {
    setOnboarded(true);
  }, [setOnboarded]);

  const trySample = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await addSampleBooks();
      const first = useAppStore.getState().books.find((b) => !b.transient);
      if (first) useAppStore.getState().openReader(first.id);
      else close();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const copy = [
    {
      title: 'One word at a time',
      body: 'Readable shows your book a single word at a time, in the same spot. Your eyes stay still and the words come to you, so there is no hunting for the next line.',
    },
    {
      title: 'Rest on the coloured letter',
      body: 'Each word has one letter in colour. Let your eye settle on it and the rest of the word is understood without effort. Faint marks above and below keep your gaze steady.',
    },
    {
      title: 'Choose a pace that feels easy',
      body: 'Start slower than you think you need. You can change speed at any time while reading, and in Settings.',
    },
  ][step];

  const content = (
    <div className="ob" data-step={step}>
      <div className="ob-top">
        <span className="ob-count" aria-live="polite">
          Step {step + 1} of {STEPS}
        </span>
        <button type="button" className="btn btn-text" onClick={close}>
          Skip intro
        </button>
      </div>

      <MiniDemo wpm={step === 1 ? Math.min(wpm, 200) : wpm} guides={step >= 1} mobile={mobile} />

      <h2 className="ob-title">{copy.title}</h2>
      <p className="ob-body">{copy.body}</p>

      {step === 2 && (
        <div className="ob-paces" role="radiogroup" aria-label="Starting speed">
          {PACES.map((p) => (
            <button
              key={p.wpm}
              type="button"
              role="radio"
              aria-checked={wpm === p.wpm}
              className={`ob-pace ${wpm === p.wpm ? 'is-on' : ''}`}
              onClick={() => setReadingPrefs({ defaultWpm: p.wpm })}
            >
              <span className="ob-pace-name">{p.name}</span>
              <span className="ob-pace-wpm tabular">{p.wpm} wpm</span>
            </button>
          ))}
        </div>
      )}

      <div className="ob-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-text" onClick={() => setStep(step - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)} autoFocus>
            Next
          </button>
        ) : (
          <div className="ob-finish">
            <button type="button" className="btn" onClick={() => openOverlay('import')}>
              Import a book
            </button>
            <button type="button" className="btn btn-primary" onClick={trySample} disabled={busy} autoFocus>
              {busy ? 'Adding sample…' : 'Try a sample'}
            </button>
          </div>
        )}
      </div>
      {failed && (
        <p className="ob-error" role="alert">
          Couldn’t add the sample books. You can try again, or import your own.
        </p>
      )}
    </div>
  );

  return mobile ? (
    <Sheet onClose={close} label="Welcome to Readable" className="ob-sheet">
      {content}
    </Sheet>
  ) : (
    <Modal onClose={close} label="Welcome to Readable" className="ob-modal">
      {content}
    </Modal>
  );
}
