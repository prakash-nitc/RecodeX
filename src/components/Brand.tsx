// RecodeX brand mark: a summit with the trail to it, on the accent. Also the source of the PWA icons.
import React, { useId } from 'react';

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`bm-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7A5CE0" /><stop offset="100%" stopColor="#4F34B0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#bm-${id})`} />
      <circle cx="45" cy="17" r="4.5" fill="#FFFFFF" fillOpacity="0.9" />
      <path d="M9 47 L24 25 L31 34 L40 19 L55 47 Z" fill="#FFFFFF" fillOpacity="0.96" />
      <path d="M40 19 L45.5 28.5 L41.5 27 L38.5 30.5 L35.5 26.5 Z" fill="#4F34B0" fillOpacity="0.28" />
      <path d="M17 47 C 24 42, 27 40, 33 41 S 42 38, 46 34" fill="none" stroke="#4F34B0" strokeOpacity="0.45" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="1 4.2" />
    </svg>
  );
}

export function BrandLockup({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={34} className="shrink-0 drop-shadow-[0_4px_10px_rgb(var(--accent)/0.35)]" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="font-display text-[19px] font-semibold tracking-tight text-fg">Recode<span className="text-accent-ink">X</span></div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Journey to mastery</div>
        </div>
      )}
    </div>
  );
}
