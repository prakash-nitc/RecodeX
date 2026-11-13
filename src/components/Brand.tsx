// RecodeX brand mark: a mountain range between code brackets, < ▲ >, with the sunrise of mastery.
// public/icon.svg is the full app icon (its review trail climbs the summit: Red → Yellow → Green,
// stops widening like review intervals); public/favicon.svg drops the trail for small sizes and is
// what the app shows. Edit those files, then run `npm run icons` to rebuild the PNGs.
import React from 'react';

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return <img src="/favicon.svg" width={size} height={size} alt="" aria-hidden draggable={false} className={className} />;
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
