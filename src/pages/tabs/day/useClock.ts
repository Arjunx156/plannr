import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The time of day, ticking every 30 seconds while the page is open. */
export function useClock(): string {
  const [now, setNow] = useState(() => hhmm(new Date()));
  useEffect(() => {
    const t = window.setInterval(() => setNow(hhmm(new Date())), 30000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}
