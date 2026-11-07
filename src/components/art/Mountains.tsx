// Original layered mountain-sunrise artwork, drawn as SVG. Painterly, anime-inspired: a sky gradient,
// a sun (or moon and stars), soft streak clouds, five silhouette ridges with atmospheric depth and mist,
// and a row of pines on the nearest ridge. The sky follows local time: dawn, day, dusk, night.
// If images are added to /public/art (dawn|day|dusk|night|hero .webp/.jpg/.png/.avif) they are used instead.
import React, { useEffect, useId, useMemo, useState } from 'react';
import artFiles from 'virtual:recodex-art';

export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';

export function phaseForHour(h: number): SkyPhase {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

/** Current sky phase from the local clock, re-checked every few minutes. */
export function useSkyPhase(): SkyPhase {
  const [p, setP] = useState(() => phaseForHour(new Date().getHours()));
  useEffect(() => {
    const t = setInterval(() => setP(phaseForHour(new Date().getHours())), 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  return p;
}

interface Palette {
  sky: [string, string, string]; sun: { core: string; glow: string; x: number; y: number; r: number; moon?: boolean };
  ridges: [string, string, string, string, string]; mist: string; mistOpacity: number; cloud: string; cloudOpacity: number; stars: number;
}

export const SKY: Record<SkyPhase, Palette> = {
  dawn: {
    sky: ['#2E2A6E', '#B5689E', '#FFB27A'], sun: { core: '#FFE6AE', glow: '#FF963D', x: 1130, y: 430, r: 46 },
    ridges: ['#A38DCB', '#7B67B2', '#58489A', '#3A3079', '#211C50'], mist: '#F9C6B2', mistOpacity: 0.42, cloud: '#FFD3B4', cloudOpacity: 0.5, stars: 0.25,
  },
  day: {
    sky: ['#5C9AE0', '#A8CAF2', '#EDF3FB'], sun: { core: '#FFFCEE', glow: '#FFE7A6', x: 1260, y: 140, r: 42 },
    ridges: ['#B9CAE6', '#93AAD4', '#6F89BE', '#5068A1', '#33497D'], mist: '#F3F7FD', mistOpacity: 0.5, cloud: '#FFFFFF', cloudOpacity: 0.75, stars: 0,
  },
  dusk: {
    sky: ['#33255F', '#C4577A', '#FF9F55'], sun: { core: '#FFD58F', glow: '#FF7A3D', x: 420, y: 440, r: 50 },
    ridges: ['#A8749F', '#835485', '#5E3B6B', '#3F2951', '#241835'], mist: '#F4A68F', mistOpacity: 0.38, cloud: '#FFB48C', cloudOpacity: 0.5, stars: 0.12,
  },
  night: {
    sky: ['#050918', '#101843', '#283171'], sun: { core: '#EEF0FA', glow: '#8C9BE0', x: 1240, y: 130, r: 30, moon: true },
    ridges: ['#3B4382', '#2D346B', '#222857', '#181D43', '#0D1130'], mist: '#5361AE', mistOpacity: 0.22, cloud: '#56619F', cloudOpacity: 0.35, stars: 1,
  },
};

// Deterministic pseudo-random numbers so the artwork is identical on every render.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const W = 1600, H = 600;

/** A ridge line: layered "ridged" sine noise gives peaks rather than rolling hills. */
function ridgePoints(seed: number, base: number, amp: number, freq: number, sharp: number): [number, number][] {
  const r = rng(seed);
  const waves = Array.from({ length: 4 }, (_, i) => ({ f: freq * (1 + i * 1.9 + r() * 0.6), p: r() * Math.PI * 2, a: 1 / (1 + i * 1.35) }));
  const norm = waves.reduce((a, w) => a + w.a, 0);
  const pts: [number, number][] = [];
  for (let x = -40; x <= W + 40; x += 20) {
    let h = 0;
    for (const w of waves) h += w.a * Math.pow(1 - Math.abs(Math.sin(x * w.f + w.p)), sharp);
    pts.push([x, base - amp * (h / norm)]);
  }
  return pts;
}

function smoothPath(pts: [number, number][]): string {
  let d = `M ${pts[0][0]} ${H} L ${pts[0][0]} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0]} ${pts[i][1].toFixed(1)} ${mx} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last[0]} ${last[1].toFixed(1)} L ${last[0]} ${H} Z`;
}

const RIDGES = [
  { seed: 11, base: 370, amp: 190, freq: 0.0042, sharp: 2.2 },
  { seed: 23, base: 420, amp: 170, freq: 0.0055, sharp: 2.0 },
  { seed: 37, base: 470, amp: 150, freq: 0.0068, sharp: 1.8 },
  { seed: 41, base: 520, amp: 120, freq: 0.0085, sharp: 1.6 },
  { seed: 59, base: 572, amp: 92, freq: 0.0105, sharp: 1.4 },
];

function hexMix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v * (1 - t) + pb[i] * t).toString(16).padStart(2, '0')).join('');
}

export function MountainScene({ phase: forced, className, label = 'Mountain range at sunrise', decorative = true, showSun = true }: {
  phase?: SkyPhase; className?: string; label?: string; decorative?: boolean; showSun?: boolean;
}) {
  const live = useSkyPhase();
  const phase = forced ?? live;
  const uid = useId().replace(/:/g, '');
  const pal = SKY[phase];
  const override = (artFiles as Record<string, string>)[phase] ?? (artFiles as Record<string, string>).hero;

  const geo = useMemo(() => {
    const ridges = RIDGES.map(r => ({ ...r, pts: ridgePoints(r.seed, r.base, r.amp, r.freq, r.sharp) }));
    const sr = rng(7);
    const stars = Array.from({ length: 90 }, () => ({ x: sr() * W, y: sr() * 330, r: 0.6 + sr() * 1.5, o: 0.35 + sr() * 0.65, d: (sr() * 4).toFixed(2) }));
    const cr = rng(99);
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: cr() * W, y: 70 + i * 34 + cr() * 30, w: 220 + cr() * 320, h: 10 + cr() * 12 }));
    const near = ridges[4].pts;
    const pr = rng(5);
    const pines = near.filter((_, i) => i % 3 === 0 && pr() > 0.35).map(([x, y]) => ({ x: x + pr() * 10, y: y + 4, h: 18 + pr() * 26 }));
    return { ridges, stars, clouds, pines };
  }, []);

  if (override) {
    return <img src={override} alt={decorative ? '' : label} aria-hidden={decorative || undefined} className={className} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />;
  }

  const g = (k: string) => `${k}-${uid}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={className} role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : label}>
      <defs>
        <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pal.sky[0]} /><stop offset="55%" stopColor={pal.sky[1]} /><stop offset="100%" stopColor={pal.sky[2]} />
        </linearGradient>
        <radialGradient id={g('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={pal.sun.glow} stopOpacity="0.85" /><stop offset="35%" stopColor={pal.sun.glow} stopOpacity="0.35" /><stop offset="100%" stopColor={pal.sun.glow} stopOpacity="0" />
        </radialGradient>
        <filter id={g('blur')} x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id={g('soft')}><feGaussianBlur stdDeviation="1.2" /></filter>
        {geo.ridges.map((_, i) => {
          const base = pal.ridges[i];
          const lit = hexMix(base, pal.sun.glow, phase === 'night' ? 0.08 : 0.22 - i * 0.03);
          const deep = hexMix(base, pal.sky[0], 0.25 + i * 0.05);
          return (
            <linearGradient key={i} id={g(`r${i}`)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lit} /><stop offset="45%" stopColor={base} /><stop offset="100%" stopColor={deep} />
            </linearGradient>
          );
        })}
        <linearGradient id={g('mist')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pal.mist} stopOpacity="0" /><stop offset="70%" stopColor={pal.mist} stopOpacity={pal.mistOpacity} /><stop offset="100%" stopColor={pal.mist} stopOpacity="0" />
        </linearGradient>
        {pal.sun.moon && (
          <mask id={g('moon')}><rect width={W} height={H} fill="white" /><circle cx={pal.sun.x + pal.sun.r * 0.45} cy={pal.sun.y - pal.sun.r * 0.25} r={pal.sun.r * 0.92} fill="black" /></mask>
        )}
      </defs>

      <rect width={W} height={H} fill={`url(#${g('sky')})`} />

      {pal.stars > 0 && (
        <g opacity={pal.stars}>
          {geo.stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o}
              style={i % 4 === 0 ? { animation: `twinkle 3.2s ease-in-out ${s.d}s infinite` } : undefined} />
          ))}
        </g>
      )}

      {showSun && (
        <g>
          <circle cx={pal.sun.x} cy={pal.sun.y} r={pal.sun.r * 6} fill={`url(#${g('glow')})`} />
          <circle cx={pal.sun.x} cy={pal.sun.y} r={pal.sun.r} fill={pal.sun.core} mask={pal.sun.moon ? `url(#${g('moon')})` : undefined} filter={`url(#${g('soft')})`} />
        </g>
      )}

      <g opacity={pal.cloudOpacity} filter={`url(#${g('blur')})`}>
        {geo.clouds.map((c, i) => <rect key={i} x={c.x - c.w / 2} y={c.y} width={c.w} height={c.h} rx={c.h / 2} fill={pal.cloud} />)}
      </g>

      {geo.ridges.map((r, i) => (
        <g key={i}>
          <path d={smoothPath(r.pts)} fill={`url(#${g(`r${i}`)})`} />
          {i < 4 && <rect x="0" y={r.base - 70} width={W} height="150" fill={`url(#${g('mist')})`} />}
        </g>
      ))}

      <g fill={hexMix(pal.ridges[4], '#000000', 0.25)}>
        {geo.pines.map((p, i) => (
          <path key={i} d={`M ${p.x} ${p.y - p.h} L ${p.x - p.h * 0.28} ${p.y} L ${p.x + p.h * 0.28} ${p.y} Z`} />
        ))}
      </g>
    </svg>
  );
}
