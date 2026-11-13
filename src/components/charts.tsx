// Small hand-drawn SVG charts. They replace Recharts (≈400 KB) for the three column charts the app has.
// Specs: bars ≤ 24px with a 4px rounded top and a square baseline, 2px surface gaps between stacked
// segments, 1px solid recessive gridlines, a legend for two or more series, a hover/focus tooltip, and
// a visually hidden table so the values never depend on the picture.
import React, { useLayoutEffect, useRef, useState } from 'react';

export interface Series { key: string; label: string; color: string }
export interface Column { key: string; label: string; title?: string; values: Record<string, number> }

function niceMax(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 4, step: 1 };
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!;
  const st = Math.max(1, Math.ceil(step)); // counts: whole-number ticks only
  return { max: Math.ceil(v / st) * st, step: st };
}

/** Rounded-top rectangle with a square base. */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function ColumnChart({ data, series, height = 176, ariaLabel, note, highlight }: {
  data: Column[]; series: Series[]; height?: number; ariaLabel: string;
  /** Extra tooltip line, e.g. "62% green". */
  note?: (c: Column, total: number) => string | null;
  /** Column key drawn with an outline cue (e.g. today). */
  highlight?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map(c => series.reduce((a, s) => a + (c.values[s.key] ?? 0), 0));
  const { max, step } = niceMax(Math.max(0, ...totals));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const left = 8 + 7 * String(max).length, right = 4, top = 8, bottom = 22;
  const plotW = Math.max(0, width - left - right), plotH = height - top - bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, Math.max(4, band * 0.62));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 44))));
  const hv = hover !== null ? data[hover] : null;

  return (
    <div className="flex h-full flex-col">
      {series.length > 1 && (
        <ul className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted" aria-hidden>
          {series.map(s => <li key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />{s.label}</li>)}
        </ul>
      )}
      <div ref={ref} className="relative min-h-0 flex-1" onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
            {ticks.map(t => (
              <g key={t}>
                <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px] tabular-nums">{t}</text>
              </g>
            ))}
            {data.map((c, i) => {
              const cx0 = left + band * i + (band - barW) / 2;
              let acc = 0;
              const segs = series.map(s => ({ s, v: c.values[s.key] ?? 0 })).filter(x => x.v > 0);
              return (
                <g key={c.key} opacity={hover === null || hover === i ? 1 : 0.45} style={{ transition: 'opacity 120ms' }}>
                  {hover === i && <rect x={left + band * i} y={top} width={band} height={plotH} fill="rgb(var(--surface2))" opacity={0.7} />}
                  {segs.map((g, j) => {
                    const y0 = y(acc), y1 = y(acc + g.v); acc += g.v;
                    const isTop = j === segs.length - 1;
                    const gap = j > 0 ? 2 : 0; // 2px surface gap below each segment above the first
                    const h = Math.max(0, y0 - y1 - gap);
                    return isTop
                      ? <path key={g.s.key} d={topRounded(cx0, y1, barW, h, 4)} fill={g.s.color} />
                      : <rect key={g.s.key} x={cx0} y={y1} width={barW} height={h} fill={g.s.color} />;
                  })}
                  {c.key === highlight && <line x1={cx0} x2={cx0 + barW} y1={top + plotH + 3} y2={top + plotH + 3} stroke="rgb(var(--accent))" strokeWidth={2} strokeLinecap="round" />}
                  {i % labelEvery === 0 && <text x={left + band * i + band / 2} y={height - 6} textAnchor="middle" className="fill-muted text-[11px]">{c.label}</text>}
                  {/* hit target: the whole band, larger than the bar */}
                  <rect x={left + band * i} y={top} width={band} height={plotH + bottom} fill="transparent" tabIndex={0}
                    aria-label={`${c.title ?? c.label}: ${totals[i]}`} className="outline-none"
                    onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
                </g>
              );
            })}
          </svg>
        )}
        {hv && hover !== null && (
          <div className="pointer-events-none absolute z-10 w-[8.75rem] rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop"
            style={{ top: 0, ...(() => {
              // Beside the bar, never over it: to the right when it fits, otherwise to the left.
              const barRight = left + band * hover + (band + barW) / 2 + 8, barLeft = left + band * hover + (band - barW) / 2 - 8;
              return barRight + 140 <= width ? { left: barRight } : { left: Math.max(0, barLeft - 140) };
            })() }}>
            <div className="mb-1 font-semibold text-muted">{hv.title ?? hv.label}</div>
            {series.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-4 text-fg">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />{s.label}</span>
                <span className="tabular-nums font-semibold">{hv.values[s.key] ?? 0}</span>
              </div>
            ))}
            {series.length > 1 && <div className="mt-1 flex justify-between border-t border-line pt-1 text-muted"><span>Total</span><span className="tabular-nums font-semibold text-fg">{totals[hover]}</span></div>}
            {note?.(hv, totals[hover]) && <div className="mt-0.5 text-muted">{note(hv, totals[hover])}</div>}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead><tr><th scope="col">Period</th>{series.map(s => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>{data.map(c => <tr key={c.key}><th scope="row">{c.title ?? c.label}</th>{series.map(s => <td key={s.key}>{c.values[s.key] ?? 0}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export const RATING_SERIES: Series[] = [
  { key: 'green', label: 'Green', color: 'rgb(var(--ok))' },
  { key: 'yellow', label: 'Yellow', color: 'rgb(var(--warn))' },
  { key: 'red', label: 'Red', color: 'rgb(var(--bad))' },
];
