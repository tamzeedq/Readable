import type { ReactNode } from 'react';

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Accessible name when label is an icon */
  ariaLabel?: string;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
  itemWidth,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  /** Fixed width for each segment (e.g. 44 for 1/2/3, 34 for icon views) */
  itemWidth?: number;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`segmented ${className ?? ''}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.ariaLabel}
          style={itemWidth ? { width: itemWidth, padding: 0 } : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ percent, height = 3, label = 'Reading progress' }: { percent: number; height?: number; label?: string }) {
  return (
    <div
      className="progress"
      style={{ height }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}
