// The dashboard banner from your own animations: a night version (public/art/dashboard.gif, 412×414) for the
// dark themes and a daylight version (public/art/dashboard-day.gif, 414×414) for the light ones.
// The banner is a wide strip and the GIFs are square, so instead of cropping, the whole GIF sits at full
// height on the right and its left edge fades into the --hero-bg background. The headline sits on the
// calm area to the left. GIFs cannot be paused, so reduced-motion users get the first frame (*-still.png).
import React from 'react';

const ART = {
  night: { gif: '/art/dashboard.gif', still: '/art/dashboard-still.png', w: 412, h: 414 },
  day: { gif: '/art/dashboard-day.gif', still: '/art/dashboard-day-still.png', w: 414, h: 414 },
} as const;
// Background beside the GIF: the --hero-bg token. In the dark themes it is sampled from the night GIF's left
// edge (night sky, wall, the lamp-lit desk, the floor); the light themes use a light gradient.
const EDGE = 'var(--hero-bg)';
const FADE = 'linear-gradient(90deg, transparent 0%, #000 42%)';

export function GifScene({ className, variant = 'night' }: { className?: string; variant?: 'night' | 'day' }) {
  const a = ART[variant];
  return (
    <div className={`art-tone ${className ?? ''}`} style={{ background: EDGE }} aria-hidden data-scene="gif" data-variant={variant}>
      <picture className="absolute inset-y-0 right-0 block h-full" style={{ aspectRatio: `${a.w} / ${a.h}` }}>
        <source srcSet={a.still} media="(prefers-reduced-motion: reduce)" />
        <img src={a.gif} alt="" width={a.w} height={a.h} decoding="async" draggable={false}
          className="h-full w-full object-cover" style={{ maskImage: FADE, WebkitMaskImage: FADE }} />
      </picture>
    </div>
  );
}
