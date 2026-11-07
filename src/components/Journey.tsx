// Journey roadmap: a winding trail up the mountain with one camp per pattern, in pattern order.
// Each camp fills with the pattern's mastery %. Hover (or tap) shows its weak counts; click opens the pattern.
// Scrolls sideways, so it stays readable with 30+ patterns.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Flag, MapPin } from 'lucide-react';
import type { Camp } from '../lib/stats';
import { cx } from './ui';

const STEP = 112, PAD = 64, H = 210, BASE = 172, RISE = 112;

function curve(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function JourneyRoadmap({ camps, onOpen }: { camps: Camp[]; onOpen: (id: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(800);
  const [sel, setSel] = useState<number | null>(null);
  const lastPointer = useRef<string>('mouse');

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth));
    ro.observe(el); setWrapW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = camps.length;
  const width = Math.max(wrapW, PAD * 2 + Math.max(0, n - 1) * STEP + 60);
  const step = n > 1 ? (width - PAD * 2 - 60) / (n - 1) : 0;
  const pts = useMemo<[number, number][]>(() => camps.map((_, i) => {
    const f = n > 1 ? i / (n - 1) : 0;
    return [PAD + i * step, BASE - RISE * f + Math.sin(i * 1.25) * 14 * (1 - f * 0.5)];
  }), [n, step]);
  const current = camps.findIndex(c => c.pct < 1 && c.total > 0);
  const here = current < 0 ? n - 1 : current;
  const summit: [number, number] = [width - PAD + 20, BASE - RISE - 26];
  const trail = [...pts, summit];

  // Bring the current camp into view.
  useEffect(() => {
    const el = wrap.current; if (!el || !pts[here]) return;
    el.scrollLeft = Math.max(0, pts[here][0] - el.clientWidth / 2);
  }, [here, width]);

  if (!n) return <p className="px-5 pb-5 text-sm text-muted">Add a pattern to start your journey.</p>;
  const s = sel !== null ? camps[sel] : camps[here];
  const si = sel !== null ? sel : here;

  const activate = (i: number) => {
    if (lastPointer.current === 'touch' && sel !== i) { setSel(i); return; }
    onOpen(camps[i].id);
  };

  // Background ridge that the trail climbs.
  const ridge = `M 0 ${H} L 0 ${BASE + 10} C ${width * 0.25} ${BASE - 10}, ${width * 0.45} ${BASE - RISE * 0.55}, ${width * 0.7} ${BASE - RISE * 0.8} S ${width - 40} ${BASE - RISE - 40}, ${width} ${BASE - RISE - 10} L ${width} ${H} Z`;

  return (
    <div>
      <div ref={wrap} className="overflow-x-auto scroll-thin" onPointerDown={e => { lastPointer.current = e.pointerType; }}>
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className="block" role="list" aria-label="Pattern journey, base camp to summit">
          <defs>
            <linearGradient id="jr-ridge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent) / 0.10)" /><stop offset="100%" stopColor="rgb(var(--accent) / 0.02)" />
            </linearGradient>
          </defs>
          <path d={ridge} fill="url(#jr-ridge)" />
          <path d={curve(trail)} fill="none" stroke="rgb(var(--line))" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
          {here > 0 && <path d={curve(trail.slice(0, here + 1))} fill="none" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinecap="round" opacity="0.75" />}

          <g transform={`translate(${summit[0]} ${summit[1]})`} aria-hidden>
            <path d="M -16 14 L 0 -10 L 16 14 Z" fill="rgb(var(--surface2))" stroke="rgb(var(--line))" />
            <line x1="0" y1="-10" x2="0" y2="-30" stroke="rgb(var(--muted))" strokeWidth="1.5" />
            <path d="M 0 -30 L 13 -25 L 0 -20 Z" fill="rgb(var(--ok))" />
            <text y="30" textAnchor="middle" className="fill-muted" fontSize="10" fontWeight="700" letterSpacing="0.08em">SUMMIT</text>
          </g>

          {camps.map((c, i) => {
            const [x, y] = pts[i];
            const R = 15, fillH = 2 * R * c.pct;
            const on = i === si;
            const label = c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name;
            return (
              <g key={c.id} role="listitem" transform={`translate(${x} ${y})`}>
                <g role="button" tabIndex={0} aria-label={`${c.name}: ${Math.round(c.pct * 100)}% mastered, ${c.r} red, ${c.y} yellow, ${c.overdue} overdue`}
                  className="cursor-pointer outline-none" onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)}
                  onClick={() => activate(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(c.id); } }}>
                  <circle r={R + 9} fill="transparent" />
                  {on && <circle r={R + 6} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" opacity="0.6" />}
                  <clipPath id={`jr-c-${i}`}><circle r={R} /></clipPath>
                  <circle r={R} fill="rgb(var(--surface))" stroke={c.pct >= 1 ? 'rgb(var(--ok))' : 'rgb(var(--line))'} strokeWidth="2" />
                  <rect x={-R} y={R - fillH} width={2 * R} height={fillH} fill="rgb(var(--ok))" opacity="0.85" clipPath={`url(#jr-c-${i})`} />
                  <circle r={R} fill="none" stroke={c.pct >= 1 ? 'rgb(var(--ok))' : 'rgb(var(--line))'} strokeWidth="2" />
                  <path d="M -6 4 L 0 -6 L 6 4 Z" fill={c.pct > 0.55 ? 'rgb(var(--surface))' : 'rgb(var(--muted))'} opacity="0.9" />
                  {c.overdue > 0 && <circle cx={R - 2} cy={-R + 2} r="5" fill="rgb(var(--hot))" stroke="rgb(var(--surface))" strokeWidth="2" />}
                  <text y={R + 16} textAnchor="middle" fontSize="11" fontWeight={on ? 700 : 600} className={on ? 'fill-fg' : 'fill-muted'}>{label}</text>
                  <text y={-R - 7} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-muted tabular-nums">{Math.round(c.pct * 100)}%</text>
                </g>
                {i === here && (
                  <g transform={`translate(0 ${-R - 30})`} aria-hidden>
                    <rect x="-34" y="-14" width="68" height="18" rx="9" fill="rgb(var(--accent))" />
                    <text y="-1.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="rgb(var(--accentfg))">You are here</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mx-4 sm:mx-5 mb-4 mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-surface2/70 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0 mr-auto">
          {si === here ? <MapPin size={15} className="text-accent-ink shrink-0" /> : <Flag size={15} className="text-muted shrink-0" />}
          <span className="font-semibold text-fg truncate">{s.name}</span>
          <span className="text-xs text-muted shrink-0">Camp {si + 1} of {n}</span>
        </div>
        <span className="text-sm text-muted tabular-nums"><b className="text-ok-ink">{Math.round(s.pct * 100)}%</b> mastered · {s.mastered}/{s.total}</span>
        <span className="text-sm tabular-nums"><span className="text-bad-ink font-semibold">{s.r}</span> <span className="text-muted">Red</span></span>
        <span className="text-sm tabular-nums"><span className="text-warn-ink font-semibold">{s.y}</span> <span className="text-muted">Yellow</span></span>
        <span className={cx('text-sm tabular-nums', s.overdue ? '' : 'text-muted')}><span className={cx('font-semibold', s.overdue ? 'text-hot-ink' : 'text-muted')}>{s.overdue}</span> <span className="text-muted">overdue</span></span>
        <button onClick={() => onOpen(s.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">Open<ArrowRight size={14} /></button>
      </div>
    </div>
  );
}
