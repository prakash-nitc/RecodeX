// The current local calendar day as React state. It changes at local midnight and is re-checked when
// the tab becomes visible or the window regains focus (timers are throttled in background tabs and
// stop while a laptop sleeps), so a tab left open overnight shows today's queue, not yesterday's.
import { useEffect, useState } from 'react';
import { today } from './dates';

function msToMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

export function useLocalDay(): string {
  const [day, setDay] = useState(today);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => setDay(d => { const t = today(); return t === d ? d : t; });
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { check(); arm(); }, msToMidnight()); };
    const onWake = () => { check(); arm(); };
    arm();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onWake); window.removeEventListener('focus', onWake); };
  }, []);
  return day;
}
