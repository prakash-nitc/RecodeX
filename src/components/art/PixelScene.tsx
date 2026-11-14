// "Pixel den": an original pixel-art scene for the dashboard hero. A coder in a hoodie and headphones,
// seen from behind at a big monitor, surrounded by gear, with the app's mountain range through the
// blinds. Drawn on a 240×72 canvas and scaled up with crisp pixels; animated at 12 fps.
//
// The palette follows the app theme: Dawn is daytime, Cloud is daytime in cool greys, Dusk is night.
// Static layers are painted once per palette; each frame only redraws what moves. The loop stops while
// the scene is off-screen or the tab is hidden, and draws a single still frame for reduced motion.
import React, { useEffect, useRef } from 'react';
import { usePalette } from '../../lib/theme';

const LW = 240, LH = 72, FPS = 12;
type Ctx = CanvasRenderingContext2D;

interface Pal {
  wall: [string, string]; panel: string;
  sky: string[]; orb: string; orbGlow: string; ridges: [string, string]; slat: string; frame: string;
  metal: string; metal2: string; metal3: string;
  desk: string; deskHi: string; deskFront: string; drawer: string;
  screen: string; screenHead: string; code: string[]; glow: string; glowAlpha: number;
  wallScreen: string; wallBar: string; wallBarHi: string;
  hoodie: string; hoodieDk: string; hoodieHi: string; hair: string; hairHi: string; rim: string;
  skin: string; skinDk: string; phones: string; lampOn: boolean; lampLight: string; shade: string;
  chair: string; chairHi: string; mug: string; steam: string; leds: string[]; ledOff: string; night: boolean;
}

const NIGHT: Pal = {
  // Dusk palette: deep navy, steel blue and cool silver, with the interactive blue on screen.
  wall: ['#0B1A22', '#11212D'], panel: '#0E1D27',
  sky: ['#04101A', '#081A26', '#0E2231', '#152C3D'], orb: '#CCD0CF', orbGlow: '#7D8E99', ridges: ['#253745', '#1A2A36'], slat: '#06141B', frame: '#0B1820',
  metal: '#0B1820', metal2: '#1A2C38', metal3: '#354956',
  desk: '#253745', deskHi: '#4A5C6A', deskFront: '#06141B', drawer: '#11212D',
  screen: '#C9D6E0', screenHead: '#9BA8AB', code: ['#4A5C6A', '#60A5FA', '#354956', '#7D8E99'], glow: '#9FC3E8', glowAlpha: 0.14,
  wallScreen: '#1A2C38', wallBar: '#4A5C6A', wallBarHi: '#9BA8AB',
  hoodie: '#4A5C6A', hoodieDk: '#354956', hoodieHi: '#7D8E99', hair: '#14232D', hairHi: '#2E4250', rim: '#C9D6E0',
  skin: '#E9AE94', skinDk: '#B9806A', phones: '#06141B', lampOn: true, lampLight: '#FFB46B', shade: '#354956',
  chair: '#06141B', chairHi: '#253745', mug: '#CCD0CF', steam: '#9BA8AB', leds: ['#35C98A', '#FFC857', '#60A5FA', '#FF963D'], ledOff: '#1A2C38', night: true,
};

const DAY: Pal = {
  wall: ['#E4DDF6', '#EEE9FB'], panel: '#E2DAF4',
  sky: ['#6FA6E6', '#8DBBEE', '#AFCFF3', '#D3E5F8'], orb: '#FFF6CF', orbGlow: '#FFE7A6', ridges: ['#93AAD4', '#6F89BE'], slat: '#D8D0EE', frame: '#BDB2E0',
  metal: '#3B3560', metal2: '#57507F', metal3: '#7A72A3',
  desk: '#B9A8E6', deskHi: '#D9CDF7', deskFront: '#8B7CC0', drawer: '#A193D2',
  screen: '#1B1F3A', screenHead: '#2A2F52', code: ['#C792EA', '#82AAFF', '#C3E88D', '#FFCB6B'], glow: '#FFFFFF', glowAlpha: 0,
  wallScreen: '#6A4BD1', wallBar: '#9D85F0', wallBarHi: '#E2D8FA',
  hoodie: '#6A4BD1', hoodieDk: '#4B33A8', hoodieHi: '#8F74E6', hair: '#3B2A22', hairHi: '#6B4A3A', rim: '#8A6A58',
  skin: '#E9AE94', skinDk: '#C48B72', phones: '#2A2448', lampOn: false, lampLight: '#FFB46B', shade: '#57507F',
  chair: '#2A2448', chairHi: '#57507F', mug: '#FFFFFF', steam: '#FFFFFF', leds: ['#35C98A', '#FFC857', '#6A4BD1', '#FF963D'], ledOff: '#57507F', night: false,
};

// Cloud: the daytime room in cool greys, slate and steel.
const CLOUD: Pal = {
  ...DAY,
  wall: ['#D6DCE3', '#E1E5EA'], panel: '#D0D6DE', slat: '#D0D6DE', frame: '#AEB5BF',
  metal: '#4E5661', metal2: '#707881', metal3: '#8F97A1',
  desk: '#AEB5BF', deskHi: '#CCD3DD', deskFront: '#8F97A1', drawer: '#9AA2AC',
  screen: '#202833', screenHead: '#2E3744', code: ['#AEB5BF', '#7FA6CC', '#CCD3DD', '#8F97A1'],
  wallScreen: '#707881', wallBar: '#8F97A1', wallBarHi: '#E1E5EA',
  hoodie: '#707881', hoodieDk: '#4E5661', hoodieHi: '#8F97A1', phones: '#202833', shade: '#707881',
  chair: '#4E5661', chairHi: '#707881', leds: ['#35C98A', '#FFC857', '#4F6E8D', '#FF963D'], ledOff: '#8F97A1',
};

// ---------------------------------------------------------------------------------------------
// pixel helpers

const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const P = (c: Ctx, x: number, y: number, col: string) => R(c, x, y, 1, 1, col);
const hash = (n: number) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

function ellipse(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    R(c, cx - hw, cy + dy, hw * 2 + 1, 1, col);
  }
}
function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    P(c, x0, y0, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function glow(c: Ctx, x: number, y: number, r: number, col: string, alpha: number) {
  if (alpha <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'transparent');
  c.globalAlpha = alpha; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------
// layout

// The room is drawn 8px lower than its coordinates so the coder sits below the dashboard headline;
// the rows above are plain wall, a calm background for the text.
const DROP = 8;
const CX = 204;                                 // the coder's centre line, in front of the monitor
const WIN = { x: 88, y: 6, w: 36, h: 33 };      // window opening, with blinds
const STARS = Array.from({ length: 16 }, (_, i) => ({ x: WIN.x + Math.floor(hash(i + 1) * WIN.w), y: WIN.y + 1 + Math.floor(hash(i + 50) * 17) }));
// LEDs: [x, y, colour index]
const LEDS: [number, number, number][] = [
  ...Array.from({ length: 8 }, (_, i) => [9 + i * 5, 34, i % 4] as [number, number, number]),
  ...Array.from({ length: 6 }, (_, i) => [11 + i * 6, 47, (i + 2) % 4] as [number, number, number]),
  [151, 41, 0], [155, 41, 1], [159, 41, 3], [151, 45, 2], [155, 45, 0], [159, 45, 1], [124, 61, 0], [128, 61, 2],
];

// ---------------------------------------------------------------------------------------------
// static layer (painted once per palette)

function paintStatic(c: Ctx, p: Pal) {
  R(c, 0, 0, LW, LH, p.wall[1]);
  R(c, 0, 0, LW, 6, p.wall[0]);
  c.save(); c.translate(0, DROP);
  for (let x = 40; x < LW; x += 48) R(c, x, -DROP, 1, 52 + DROP, p.panel);
  glow(c, CX, 26, 48, p.glow, p.glowAlpha);

  // window: sky bands, sun or moon, mountains
  const bandH = Math.ceil(WIN.h / p.sky.length);
  p.sky.forEach((col, i) => R(c, WIN.x, WIN.y + i * bandH, WIN.w, bandH, col));
  glow(c, 115, 13, 9, p.orbGlow, 0.5);
  ellipse(c, 115, 13, 3, 3, p.orb);
  if (p.night) ellipse(c, 117, 12, 3, 3, p.sky[0]);
  for (let x = WIN.x; x < WIN.x + WIN.w; x++) {
    const far = Math.round(26 + 4 * Math.sin(x * 0.21) + 3 * Math.sin(x * 0.53 + 1));
    const near = Math.round(32 + 3 * Math.sin(x * 0.17 + 2) + 2 * Math.sin(x * 0.41));
    R(c, x, far, 1, WIN.y + WIN.h - far, p.ridges[0]);
    R(c, x, near, 1, WIN.y + WIN.h - near, p.ridges[1]);
  }

  // left wall screen and rack
  R(c, 8, 6, 41, 22, p.metal); R(c, 9, 7, 39, 20, p.metal2); R(c, 10, 8, 37, 18, p.wallScreen);
  R(c, 6, 31, 45, 21, p.metal); R(c, 7, 32, 43, 19, p.metal2);
  R(c, 7, 38, 43, 1, p.metal); R(c, 7, 44, 43, 1, p.metal);
  for (let i = 0; i < 6; i++) { R(c, 10 + i * 6, 40, 1, 3, p.metal3); P(c, 10 + i * 6, 40 + (i % 3), p.wallBarHi); }
  line(c, 28, 28, 30, 31, p.metal3);

  // lamp
  R(c, 57, 50, 9, 2, p.metal2); line(c, 61, 50, 66, 38, p.metal3); line(c, 66, 38, 75, 31, p.metal3);
  R(c, 72, 27, 11, 2, p.shade); R(c, 73, 29, 10, 2, p.shade); R(c, 74, 31, 9, 1, p.shade);

  // wall speaker and the gear on the desk
  R(c, 134, 4, 17, 23, p.metal); R(c, 135, 5, 15, 21, p.metal2);
  ellipse(c, 142, 10, 3, 3, p.metal); ellipse(c, 142, 20, 5, 4, p.metal); ellipse(c, 142, 20, 2, 2, p.metal3);
  R(c, 128, 38, 37, 14, p.metal); R(c, 129, 39, 35, 12, p.metal2); R(c, 131, 41, 16, 8, p.metal);
  line(c, 150, 27, 153, 38, p.metal);

  // big monitor
  R(c, 174, 6, 61, 39, p.metal); R(c, 175, 7, 59, 37, p.metal2);
  R(c, 177, 9, 55, 33, p.screen); R(c, 177, 9, 55, 2, p.screenHead);
  P(c, 179, 9, p.leds[3]); P(c, 181, 9, p.leds[1]); P(c, 183, 9, p.leds[0]);
  R(c, 200, 45, 9, 5, p.metal2); R(c, 194, 50, 21, 2, p.metal3);
  line(c, 234, 40, 238, 51, p.metal);

  // desk, drawers, tower
  R(c, 0, 52, LW, 2, p.desk); R(c, 0, 52, LW, 1, p.deskHi); R(c, 0, 54, LW, LH, p.deskFront);
  R(c, 6, 56, 31, 16, p.drawer);
  for (const y of [57, 62, 67]) { R(c, 7, y, 29, 4, p.deskFront); R(c, 19, y + 1, 5, 1, p.drawer); }
  R(c, 120, 57, 27, 15, p.metal); R(c, 121, 58, 25, 14, p.metal2); R(c, 122, 64, 23, 1, p.metal);

  // keyboard, mouse, mug
  R(c, 170, 50, 26, 2, p.metal3); for (let x = 171; x < 195; x += 2) P(c, x, 50, p.metal2);
  R(c, 228, 51, 3, 1, p.metal3);
  R(c, 96, 47, 4, 5, p.mug); P(c, 100, 48, p.mug); P(c, 100, 50, p.mug);

  // chair back
  R(c, CX - 15, 56, 31, 16, p.chair); R(c, CX - 15, 56, 31, 1, p.chairHi);

  // the coder's back: hoodie, hood, neck (the head is drawn per frame)
  for (let y = 40; y <= 57; y++) {
    const hw = y < 44 ? 9 + Math.round((y - 40) * 1.5) : Math.min(19, 15 + (y - 44));
    R(c, CX - hw, y, hw * 2 + 1, 1, p.hoodie);
    R(c, CX - hw, y, 2, 1, p.hoodieDk); R(c, CX + hw - 1, y, 2, 1, p.hoodieDk);
  }
  R(c, CX - 8, 40, 17, 1, p.hoodieHi);
  ellipse(c, CX, 42, 8, 2, p.hoodieDk); R(c, CX - 4, 42, 9, 1, p.hoodie);
  R(c, CX - 3, 37, 7, 4, p.skinDk);
  line(c, CX - 15, 46, CX - 22, 50, p.hoodie); line(c, CX - 15, 47, CX - 21, 50, p.hoodie);
  line(c, CX + 15, 46, CX + 21, 50, p.hoodie); line(c, CX + 15, 47, CX + 20, 50, p.hoodie);
  R(c, CX + 21, 50, 3, 1, p.skin);
  c.restore();
}

// ---------------------------------------------------------------------------------------------
// moving parts (every frame)

function paintFrame(c: Ctx, bg: HTMLCanvasElement, p: Pal, f: number) {
  c.drawImage(bg, 0, 0);
  c.save(); c.translate(0, DROP);

  // window: stars twinkle at night, clouds drift by day; blinds over the top
  if (p.night) {
    STARS.forEach((s, i) => { if (s.y < 26 && hash(i * 7 + Math.floor(f / (6 + (i % 5)))) > 0.35) P(c, s.x, s.y, i % 4 ? '#C9D2F5' : '#FFFFFF'); });
  } else {
    for (const [base, y, w] of [[0, 9, 9], [19, 15, 7]] as const) {
      const x = WIN.x + ((Math.floor(f / 5) + base) % (WIN.w + w)) - w;
      for (let i = 0; i < w; i++) if (x + i >= WIN.x && x + i < WIN.x + WIN.w) { P(c, x + i, y, '#FFFFFF'); if (i > 1 && i < w - 2) P(c, x + i, y - 1, '#FFFFFF'); }
    }
  }
  for (let y = WIN.y; y < WIN.y + WIN.h; y += 3) R(c, WIN.x, y, WIN.w, 1, p.slat);
  R(c, 101, WIN.y, 1, WIN.h, p.slat); R(c, 111, WIN.y, 1, WIN.h, p.slat);
  R(c, WIN.x - 2, WIN.y - 2, WIN.w + 4, 2, p.frame); R(c, WIN.x - 2, WIN.y + WIN.h, WIN.w + 4, 2, p.frame);
  R(c, WIN.x - 2, WIN.y, 2, WIN.h, p.frame); R(c, WIN.x + WIN.w, WIN.y, 2, WIN.h, p.frame);

  // wall screen: a scan line and live bars
  R(c, 10, 8 + (f % 18), 37, 1, p.wallBar);
  for (let i = 0; i < 4; i++) {
    const len = 6 + Math.floor(hash(i * 13 + Math.floor(f / 4)) * 20);
    R(c, 12, 11 + i * 4, len, 2, i === 0 ? p.wallBarHi : p.wallBar);
  }

  // main monitor: code scrolls up a line every half second, cursor blinks
  const step = Math.floor(f / 6);
  for (let row = 0; row < 9; row++) {
    const n = step + row;
    const indent = [0, 3, 6, 6, 3, 9, 3, 0][n % 8];
    const len = Math.min(6 + Math.floor(hash(n) * 30), 49 - indent);
    R(c, 180 + indent, 13 + row * 3, len, 1, p.code[n % p.code.length]);
    if (row === 8 && f % 12 < 6) R(c, 181 + indent + len, 12 + row * 3, 2, 2, p.code[0]);
  }

  // gear: waveform and LEDs
  for (let x = 0; x < 14; x++) P(c, 132 + x, 45 + Math.round(2.4 * Math.sin((x + f) * 0.55)), p.leds[0]);
  LEDS.forEach(([x, y, k], i) => P(c, x, y, hash(i * 31 + Math.floor(f / (3 + (i % 6)))) > 0.4 ? p.leds[k] : p.ledOff));

  // lamp light (night), with a rare flicker
  if (p.lampOn) {
    c.globalAlpha = f % 113 < 2 ? 0.08 : 0.22; c.fillStyle = p.lampLight;
    c.beginPath(); c.moveTo(72, 31); c.lineTo(84, 31); c.lineTo(104, 52); c.lineTo(60, 52); c.closePath(); c.fill();
    c.globalAlpha = 1;
    R(c, 74, 32, 8, 1, p.lampLight);
  }

  // steam from the mug
  for (let i = 0; i < 3; i++) {
    const t = (f + i * 7) % 21;
    if (t < 15) P(c, 97 + ((t >> 2) + i) % 3, 46 - Math.floor(t / 2), p.steam);
  }

  // typing hand
  const tap = [0, 1, 0, 0, 1, 1, 0, 1][f % 8];
  R(c, CX - 26 + tap, 49 + (tap ? 0 : 1), 4, 1, p.skin);

  // head: nods to the beat; messy hair with a rim of screen light; headphones
  const hx = CX, hy = 29 + (Math.floor(f / 6) % 2);
  ellipse(c, hx, hy, 9, 9, p.hair);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.05 + i * 0.11);
    const sx = Math.round(hx + Math.cos(a) * 10), sy = Math.round(hy + Math.sin(a) * 10);
    P(c, sx, sy, p.hair); if (i % 2) P(c, sx + (i < 4 ? -1 : 1), sy - 1, p.hair);
  }
  for (let i = 0; i < 6; i++) P(c, hx - 5 + i * 2, hy - 7 + (i % 2), p.hairHi);
  for (let i = 0; i < 7; i++) P(c, hx - 6 + i * 2, hy - 10 + Math.abs(3 - i) % 2, p.rim);
  line(c, hx - 9, hy - 3, hx - 4, hy - 9, p.phones); line(c, hx - 4, hy - 9, hx + 4, hy - 9, p.phones); line(c, hx + 4, hy - 9, hx + 9, hy - 3, p.phones);
  R(c, hx - 11, hy - 3, 3, 7, p.phones); R(c, hx + 9, hy - 3, 3, 7, p.phones);
  P(c, hx - 10, hy - 1, p.leds[3]);
  c.restore();
}

// ---------------------------------------------------------------------------------------------

export function PixelScene({ className }: { className?: string }) {
  const palette = usePalette();
  const dusk = palette === 'dusk';
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const c = cv.getContext('2d'); if (!c) return;
    const pal = dusk ? NIGHT : palette === 'cloud' ? CLOUD : DAY;
    const bg = document.createElement('canvas'); bg.width = LW; bg.height = LH;
    const bc = bg.getContext('2d'); if (!bc) return;
    paintStatic(bc, pal);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let f = 0, timer = 0, onScreen = true;
    const draw = () => paintFrame(c, bg, pal, f);
    const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };
    const start = () => {
      if (timer || !onScreen || document.hidden || reduce.matches) return;
      timer = window.setInterval(() => { f++; draw(); }, 1000 / FPS);
    };
    const sync = () => { stop(); start(); };
    draw(); start();

    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }) : null;
    io?.observe(cv);
    document.addEventListener('visibilitychange', sync);
    reduce.addEventListener?.('change', sync);
    return () => { stop(); io?.disconnect(); document.removeEventListener('visibilitychange', sync); reduce.removeEventListener?.('change', sync); };
  }, [palette]);

  return (
    <canvas ref={ref} width={LW} height={LH} className={className} data-scene="pixel" data-palette={dusk ? 'night' : 'day'}
      style={{ imageRendering: 'pixelated', objectFit: 'cover', objectPosition: '100% 100%' }}
      role="img" aria-label={`Pixel-art animation: someone coding at a big monitor${dusk ? ' late at night' : ' in the daytime'}`} />
  );
}
