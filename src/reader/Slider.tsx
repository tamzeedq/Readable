import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * Paper-style slider: 3px track, accent fill, optional ticks, round thumb.
 * Pointer-draggable (fires onChange while dragging) and keyboard accessible.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  pageStep,
  onChange,
  onCommit,
  label,
  valueText,
  height = 16,
  thumb = 14,
  ticks,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Arrow-key step (defaults to step) */
  pageStep?: number;
  onChange: (v: number) => void;
  /** Called when a drag ends */
  onCommit?: () => void;
  label: string;
  valueText?: string;
  height?: number;
  thumb?: number;
  /** Tick positions as fractions 0..1 */
  ticks?: number[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const span = Math.max(1e-9, max - min);
  const pct = Math.max(0, Math.min(100, ((value - min) / span) * 100));

  const fromClientX = (x: number) => {
    const el = ref.current;
    if (!el) return value;
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width)));
    const raw = min + f * span;
    return Math.max(min, Math.min(max, Math.round(raw / step) * step));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    onChange(fromClientX(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    onChange(fromClientX(e.clientX));
  };
  const end = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = pageStep ?? step;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - k;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + k;
        break;
      case 'PageDown':
        next = value - k * 10;
        break;
      case 'PageUp':
        next = value + k * 10;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
    }
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(Math.max(min, Math.min(max, next)));
    onCommit?.();
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={`rd-slider ${className ?? ''}`}
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rd-slider-track" />
      <div className="rd-slider-fill" style={{ width: `${pct}%` }} />
      {ticks?.map((t, i) => (
        <span key={i} className="rd-slider-tick" style={{ left: `${t * 100}%` }} />
      ))}
      <span
        className="rd-slider-thumb"
        style={{ left: `${pct}%`, width: thumb, height: thumb, marginLeft: -thumb / 2 }}
      />
    </div>
  );
}
