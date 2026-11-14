// "Late-night session": an original, animated lofi-style scene for the dashboard hero. Someone in a
// hoodie and headphones codes at a laptop by a window, seen over the shoulder. Through the window is
// the app's mountain range, with the sky following the local time like MountainScene.
//
// Pure SVG + CSS (a few KB, sharp at any size). Only transform and opacity are animated. Motion stops
// for prefers-reduced-motion and pauses while the scene is off-screen; the still frame is a complete
// picture (all code typed, steam and notes hidden).
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SKY, useSkyPhase, type SkyPhase } from './Mountains';

const W = 1000, H = 300;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** A soft ridge line across the window, from layered sines. */
function ridge(seed: number, x0: number, x1: number, base: number, amp: number, bottom: number) {
  const r = rng(seed);
  const waves = [0, 1, 2].map(i => ({ f: (0.012 + r() * 0.01) * (1 + i * 1.7), p: r() * 6.3, a: 1 / (1 + i) }));
  const norm = waves.reduce((a, w) => a + w.a, 0);
  let d = `M${x0} ${bottom}`;
  for (let x = x0; x <= x1; x += 8) {
    const h = waves.reduce((a, w) => a + w.a * Math.pow(1 - Math.abs(Math.sin(x * w.f + w.p)), 1.6), 0) / norm;
    d += ` L${x} ${(base - amp * h).toFixed(1)}`;
  }
  return `${d} L${x1} ${bottom} Z`;
}

// Room tone per time of day (wall top, wall bottom, desk top, desk front).
const ROOM: Record<SkyPhase, { wall: [string, string]; desk: string; deskFront: string; lights: number }> = {
  dawn: { wall: ['#2B2552', '#191533'], desk: '#41356F', deskFront: '#16122C', lights: 0.8 },
  day: { wall: ['#3A3C76', '#232552'], desk: '#4A4282', deskFront: '#1B1838', lights: 0.45 },
  dusk: { wall: ['#2C1E47', '#1A132F'], desk: '#433068', deskFront: '#160F2A', lights: 0.9 },
  night: { wall: ['#1C1738', '#110E26'], desk: '#382C62', deskFront: '#120E25', lights: 1 },
};

// Celestial body inside the window, per phase.
const ORB: Record<SkyPhase, { x: number; y: number; r: number }> = {
  dawn: { x: 455, y: 168, r: 22 }, day: { x: 470, y: 78, r: 20 }, dusk: { x: 180, y: 165, r: 24 }, night: { x: 470, y: 82, r: 16 },
};

// Code on the laptop: [indent, length, colour] per line. Lines "type" themselves, one after another.
const CODE: [number, number, string][] = [
  [0, 62, '#C792EA'], [8, 78, '#82AAFF'], [16, 54, '#C3E88D'], [16, 70, '#FFCB6B'],
  [8, 36, '#89DDFF'], [8, 84, '#82AAFF'], [16, 46, '#F07178'], [0, 12, '#C792EA'],
];
const CYCLE = 11; // seconds for the screen to fill and clear

function codeKeyframes() {
  return CODE.map((_, i) => {
    const a = 4 + i * 10, b = a + 7;
    return `@keyframes rxs-line${i}{0%,${a}%{transform:scaleX(0)}${b}%,90%{transform:scaleX(1);opacity:1}96%,100%{transform:scaleX(1);opacity:0}}`
      + `.rxs-line${i}{animation:rxs-line${i} ${CYCLE}s linear infinite}`;
  }).join('');
}

const STYLE = `
.rxs *{transform-box:fill-box}
@keyframes rxs-bob{0%,100%{transform:rotate(-1.4deg)}50%{transform:rotate(1.6deg) translateY(1.5px)}}
@keyframes rxs-type{0%,100%{transform:translateY(0)}12%{transform:translateY(-2.4px)}24%{transform:translateY(0)}40%{transform:translateY(-1.6px)}52%{transform:translateY(0)}70%{transform:translateY(-2.8px)}82%{transform:translateY(0)}}
@keyframes rxs-steam{0%{transform:translateY(6px) scaleY(.7);opacity:0}25%{opacity:.55}100%{transform:translateY(-26px) scaleY(1.1);opacity:0}}
@keyframes rxs-note{0%{transform:translate(0,0) rotate(-8deg);opacity:0}15%{opacity:.95}100%{transform:translate(26px,-58px) rotate(12deg);opacity:0}}
@keyframes rxs-twinkle{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes rxs-bulb{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes rxs-drift{from{transform:translateX(-140px)}to{transform:translateX(560px)}}
@keyframes rxs-glow{0%,100%{opacity:.75}45%{opacity:1}60%{opacity:.85}}
@keyframes rxs-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes rxs-shoot{0%,88%{transform:translate(0,0);opacity:0}89%{opacity:1}94%,100%{transform:translate(150px,62px);opacity:0}}
.rxs-bob{transform-box:view-box;transform-origin:842px 214px;animation:rxs-bob 1.5s ease-in-out infinite}
.rxs-hand{animation:rxs-type .95s linear infinite}
.rxs-steam{animation:rxs-steam 3.6s ease-out infinite}
.rxs-note{animation:rxs-note 4.8s ease-out infinite}
.rxs-twinkle{animation:rxs-twinkle 3.2s ease-in-out infinite}
.rxs-bulb{animation:rxs-bulb 2.6s ease-in-out infinite}
.rxs-drift{animation:rxs-drift 90s linear infinite}
.rxs-glow{animation:rxs-glow 5s ease-in-out infinite}
.rxs-blink{animation:rxs-blink 1.05s steps(1) infinite}
.rxs-shoot{animation:rxs-shoot 13s linear infinite}
[class*="rxs-line"]{transform-origin:left center}
/* still frame: everything typed, nothing mid-flight */
.rxs-steam,.rxs-note,.rxs-shoot{opacity:0}
.rxs[data-paused] *{animation-play-state:paused!important}
@media (prefers-reduced-motion: reduce){.rxs *{animation:none!important}}
${codeKeyframes()}
`;

export function StudyScene({ phase: forced, className }: { phase?: SkyPhase; className?: string }) {
  const live = useSkyPhase();
  const phase = forced ?? live;
  const sky = SKY[phase], room = ROOM[phase], orb = ORB[phase];
  const id = useId().replace(/:/g, '');
  const u = (n: string) => `rxs-${n}-${id}`;
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);

  // Pause the loop while the hero is scrolled out of view.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const stars = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 46 }, () => ({ x: 88 + r() * 484, y: 42 + r() * 105, s: 0.6 + r() * 1.1, d: r() * 3.2 }));
  }, []);
  const ridges = useMemo(() => [
    ridge(11, 82, 578, 168, 46, 222), ridge(23, 82, 578, 192, 34, 222), ridge(37, 82, 578, 212, 20, 222),
  ], []);
  const bulbs = useMemo(() => Array.from({ length: 19 }, (_, i) => {
    const x = 40 + i * 52; const sag = 10 * Math.sin((i / 18) * Math.PI);
    return { x, y: 14 + sag, c: ['#FFC857', '#FF963D', '#F7A8C8', '#9BE3C8'][i % 4], d: (i * 0.37) % 2.6 };
  }), []);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMid slice" className={`rxs ${className ?? ''}`}
      data-paused={visible ? undefined : ''} role="img" aria-label="Animated illustration: someone coding on a laptop by a window, late at night">
      <style>{STYLE}</style>
      <defs>
        <linearGradient id={u('wall')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={room.wall[0]} /><stop offset="1" stopColor={room.wall[1]} /></linearGradient>
        <linearGradient id={u('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.sky[0]} /><stop offset="0.55" stopColor={sky.sky[1]} /><stop offset="1" stopColor={sky.sky[2]} />
        </linearGradient>
        <radialGradient id={u('orb')}><stop offset="0" stopColor={sky.sun.glow} stopOpacity="0.55" /><stop offset="1" stopColor={sky.sun.glow} stopOpacity="0" /></radialGradient>
        <radialGradient id={u('screen')}><stop offset="0" stopColor="#9DB4FF" stopOpacity="0.42" /><stop offset="1" stopColor="#9DB4FF" stopOpacity="0" /></radialGradient>
        <radialGradient id={u('lamp')}><stop offset="0" stopColor="#FFB86B" stopOpacity="0.5" /><stop offset="1" stopColor="#FFB86B" stopOpacity="0" /></radialGradient>
        <linearGradient id={u('hoodie')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5D4AC0" /><stop offset="1" stopColor="#3A2C86" /></linearGradient>
        <linearGradient id={u('shoot')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0" /><stop offset="1" stopColor="#FFFFFF" /></linearGradient>
        <clipPath id={u('win')}><rect x="82" y="38" width="496" height="184" rx="3" /></clipPath>
        <clipPath id={u('scr')}><rect x="660" y="154" width="128" height="74" rx="2" /></clipPath>
      </defs>

      {/* room */}
      <rect width={W} height={H} fill={`url(#${u('wall')})`} />

      {/* window: the journey outside */}
      <rect x="70" y="26" width="520" height="208" rx="7" fill="#3A3068" />
      <g clipPath={`url(#${u('win')})`}>
        <rect x="82" y="38" width="496" height="184" fill={`url(#${u('sky')})`} />
        {sky.stars > 0 && stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#FFFFFF" opacity={sky.stars} className={i % 3 === 0 ? 'rxs-twinkle' : undefined} style={i % 3 === 0 ? { animationDelay: `${s.d}s` } : undefined} />
        ))}
        {phase === 'night' && <g className="rxs-shoot"><line x1="150" y1="52" x2="196" y2="71" stroke={`url(#${u('shoot')})`} strokeWidth="1.6" strokeLinecap="round" /></g>}
        <circle cx={orb.x} cy={orb.y} r={orb.r * 3.2} fill={`url(#${u('orb')})`} />
        <circle cx={orb.x} cy={orb.y} r={orb.r} fill={sky.sun.core} />
        {sky.sun.moon && <circle cx={orb.x + orb.r * 0.45} cy={orb.y - orb.r * 0.3} r={orb.r * 0.92} fill={sky.sky[1]} />}
        <g className="rxs-drift" opacity={sky.cloudOpacity}>
          <rect x="60" y="66" width="190" height="9" rx="4.5" fill={sky.cloud} />
          <rect x="250" y="104" width="130" height="7" rx="3.5" fill={sky.cloud} opacity="0.8" />
        </g>
        <g className="rxs-drift" style={{ animationDelay: '-45s' }} opacity={sky.cloudOpacity * 0.8}>
          <rect x="40" y="88" width="150" height="8" rx="4" fill={sky.cloud} />
        </g>
        <path d={ridges[0]} fill={sky.ridges[1]} />
        <path d={ridges[1]} fill={sky.ridges[2]} />
        <path d={ridges[2]} fill={sky.ridges[3]} />
        <rect x="82" y="38" width="496" height="184" fill="#FFFFFF" opacity="0.04" />
        <path d="M120 38 L200 38 L110 222 L82 222 L82 110 Z" fill="#FFFFFF" opacity="0.05" />
      </g>
      <rect x="326" y="38" width="8" height="184" fill="#3A3068" />
      <rect x="82" y="126" width="496" height="6" fill="#3A3068" />
      <rect x="60" y="230" width="540" height="9" rx="3" fill="#4A3E82" />
      {/* a plant on the sill */}
      <g>
        <path d="M104 230 L108 212 L132 212 L136 230 Z" fill="#B66A55" />
        <ellipse cx="114" cy="203" rx="5" ry="12" fill="#3E8C78" transform="rotate(-22 114 203)" />
        <ellipse cx="126" cy="201" rx="5" ry="13" fill="#4FA48A" transform="rotate(18 126 201)" />
        <ellipse cx="120" cy="198" rx="4.5" ry="14" fill="#5DB89A" />
      </g>

      {/* fairy lights */}
      <path d={`M40 14 ${bulbs.map(b => `L${b.x} ${b.y.toFixed(1)}`).join(' ')}`} fill="none" stroke="#0E0B1E" strokeOpacity="0.6" strokeWidth="1.2" />
      {bulbs.map((b, i) => (
        <g key={i} opacity={room.lights}>
          <circle cx={b.x} cy={b.y + 4} r="7" fill={b.c} opacity="0.18" />
          <circle cx={b.x} cy={b.y + 4} r="2.6" fill={b.c} className="rxs-bulb" style={{ animationDelay: `${b.d}s` }} />
        </g>
      ))}

      {/* desk */}
      <rect x="0" y="244" width={W} height="9" fill={room.desk} />
      <rect x="0" y="244" width={W} height="1.5" fill="#FFFFFF" opacity="0.12" />
      <rect x="0" y="253" width={W} height={H - 253} fill={room.deskFront} />

      {/* lamp light and screen light on the desk */}
      <ellipse cx="560" cy="244" rx="120" ry="40" fill={`url(#${u('lamp')})`} />
      <ellipse cx="724" cy="214" rx="210" ry="120" fill={`url(#${u('screen')})`} className="rxs-glow" />

      {/* books and a desk lamp */}
      <rect x="520" y="234" width="72" height="10" rx="1.5" fill="#C35D78" />
      <rect x="526" y="225" width="62" height="9" rx="1.5" fill="#3F8F87" />
      <rect x="522" y="217" width="66" height="8" rx="1.5" fill="#7A5FC0" />
      <path d="M552 217 L560 168 L590 150" fill="none" stroke="#2A2246" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M580 141 L606 158 L596 170 L571 154 Z" fill="#2A2246" />
      <circle cx="600" cy="168" r="30" fill={`url(#${u('lamp')})`} />
      <ellipse cx="601" cy="166" rx="9" ry="3.2" fill="#FFD9A0" transform="rotate(36 601 166)" />

      {/* mug with steam */}
      <rect x="616" y="226" width="20" height="18" rx="3" fill="#E8E1F7" />
      <path d="M636 230 q8 0 8 6 q0 6 -8 6" fill="none" stroke="#E8E1F7" strokeWidth="3" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7">
        <path className="rxs-steam" d="M622 220 q-5 -7 0 -14 q5 -7 0 -14" />
        <path className="rxs-steam" style={{ animationDelay: '1.2s' }} d="M630 220 q5 -7 0 -14 q-5 -7 0 -14" />
        <path className="rxs-steam" style={{ animationDelay: '2.4s' }} d="M626 222 q-4 -6 0 -12 q4 -6 0 -12" />
      </g>

      {/* laptop, screen facing us over the coder's shoulder */}
      <rect x="652" y="146" width="144" height="90" rx="6" fill="#2B2540" />
      <rect x="660" y="154" width="128" height="74" rx="2" fill="#151227" />
      <g clipPath={`url(#${u('scr')})`}>
        <rect x="660" y="154" width="128" height="9" fill="#211C3A" />
        <circle cx="667" cy="158.5" r="1.6" fill="#F0565B" /><circle cx="673" cy="158.5" r="1.6" fill="#FFC857" /><circle cx="679" cy="158.5" r="1.6" fill="#35C98A" />
        {CODE.map(([indent, len, color], i) => (
          <g key={i}>
            <rect x="665" y={168 + i * 7.4} width="5" height="2.6" fill="#4A4470" />
            <rect x={674 + indent} y={168 + i * 7.4} width={len} height="2.6" rx="1.3" fill={color} className={`rxs-line${i}`} />
          </g>
        ))}
        <rect x="688" y={168 + CODE.length * 7.4 - 1} width="4" height="5" fill="#E8E1F7" className="rxs-blink" />
      </g>
      <path d="M640 236 L808 236 L816 244 L632 244 Z" fill="#8E86B8" />
      <rect x="700" y="238" width="48" height="2" rx="1" fill="#6F6799" />

      {/* the coder, seen over the shoulder */}
      <g>
        {/* chair back */}
        <rect x="878" y="196" width="104" height="120" rx="22" fill="#14102A" />
        {/* hoodie: shoulders and back */}
        <path d="M770 300 C 772 248, 796 214, 842 210 C 892 206, 930 230, 946 300 Z" fill={`url(#${u('hoodie')})`} />
        <path d="M812 214 C 826 228, 860 230, 876 214 C 866 206, 822 206, 812 214 Z" fill="#2E2470" />
        {/* the arm reaching for the keyboard; the hand types */}
        <path d="M792 246 C 774 236, 758 234, 742 236" fill="none" stroke={`url(#${u('hoodie')})`} strokeWidth="17" strokeLinecap="round" />
        <g className="rxs-hand"><ellipse cx="735" cy="236" rx="9" ry="5.5" fill="#E7B79A" /></g>
        {/* head, hair and headphones nod to the music */}
        <g className="rxs-bob">
          <rect x="832" y="196" width="20" height="18" rx="6" fill="#C9957C" />
          <ellipse cx="842" cy="170" rx="31" ry="33" fill="#1E1834" />
          <path d="M815 158 C 818 136, 842 128, 860 136 C 852 132, 836 136, 830 146 C 826 140, 819 146, 815 158 Z" fill="#2A2247" />
          <path d="M813 168 C 812 150, 824 138, 836 136" fill="none" stroke="#9DB4FF" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M809 162 C 808 128, 876 126, 876 162" fill="none" stroke="#2D2550" strokeWidth="7" strokeLinecap="round" />
          <rect x="801" y="158" width="15" height="26" rx="7" fill="#2D2550" />
          <rect x="869" y="158" width="15" height="26" rx="7" fill="#2D2550" />
          <circle cx="808" cy="171" r="2.2" fill="#FF963D" />
        </g>
        {/* music notes drifting from the headphones */}
        <g fill="#FFD27A">
          <g className="rxs-note"><text x="884" y="150" fontSize="18" fontFamily="serif">♪</text></g>
          <g className="rxs-note" style={{ animationDelay: '1.6s' }}><text x="896" y="166" fontSize="15" fontFamily="serif">♫</text></g>
          <g className="rxs-note" style={{ animationDelay: '3.2s' }}><text x="878" y="172" fontSize="13" fontFamily="serif">♪</text></g>
        </g>
      </g>
    </svg>
  );
}
