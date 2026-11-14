// The dashboard banner from your own animation (public/art/dashboard.gif, 412×414).
// The banner is a wide strip and the GIF is square, so instead of cropping it the whole GIF sits at
// full height on the right, and its left edge fades into a background sampled from that edge
// (scripts: see the commit). The headline sits on the calm area to the left.
// GIFs cannot be paused, so reduced-motion users get the first frame (dashboard-still.png).
import React from 'react';

// Background beside the GIF: the --hero-bg token. In Dawn and Dusk it is sampled from the GIF's left edge
// (night sky, wall, the lamp-lit desk, the floor); Cloud uses a light cool grey.
const EDGE = 'var(--hero-bg)';
const FADE = 'linear-gradient(90deg, transparent 0%, #000 42%)';

export function GifScene({ className }: { className?: string }) {
  return (
    <div className={`art-tone ${className ?? ''}`} style={{ background: EDGE }} aria-hidden data-scene="gif">
      <picture className="absolute inset-y-0 right-0 block h-full aspect-[412/414]">
        <source srcSet="/art/dashboard-still.png" media="(prefers-reduced-motion: reduce)" />
        <img src="/art/dashboard.gif" alt="" width={412} height={414} decoding="async" draggable={false}
          className="h-full w-full object-cover" style={{ maskImage: FADE, WebkitMaskImage: FADE }} />
      </picture>
    </div>
  );
}
