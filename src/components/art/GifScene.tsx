// The dashboard banner from your own animation (public/art/dashboard.gif, 412×414).
// The banner is a wide strip and the GIF is square, so instead of cropping it the whole GIF sits at
// full height on the right, and its left edge fades into a background sampled from that edge
// (scripts: see the commit). The headline sits on the calm area to the left.
// GIFs cannot be paused, so reduced-motion users get the first frame (dashboard-still.png).
import React from 'react';

// The GIF's left edge, top to bottom: night sky, wall, the lamp-lit desk, the floor.
const EDGE = 'linear-gradient(180deg, #020e22 0%, #030d1f 30%, #041833 55%, #092849 76%, #020b1c 100%)';
const FADE = 'linear-gradient(90deg, transparent 0%, #000 42%)';

export function GifScene({ className }: { className?: string }) {
  return (
    <div className={className} style={{ background: EDGE }} aria-hidden data-scene="gif">
      <picture className="absolute inset-y-0 right-0 block h-full aspect-[412/414]">
        <source srcSet="/art/dashboard-still.png" media="(prefers-reduced-motion: reduce)" />
        <img src="/art/dashboard.gif" alt="" width={412} height={414} decoding="async" draggable={false}
          className="h-full w-full object-cover" style={{ maskImage: FADE, WebkitMaskImage: FADE }} />
      </picture>
    </div>
  );
}
