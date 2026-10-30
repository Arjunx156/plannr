import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

/** About a second of frames: long enough for a lazily loaded screen to arrive. */
const MAX_FRAMES = 60;

/**
 * Moving between screens doesn't reload the page, so a screen reader would say nothing. After each
 * move this reads out the new screen's title and starts focus at its content, as a page load would.
 * It leaves focus alone when a dialog has just opened, so a sheet keeps the keyboard.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    let frames = 0;
    let frame = 0;
    const announce = () => {
      const main = document.getElementById("main");
      const dialog = document.querySelector('dialog[open], [role="dialog"]');
      if (main && !dialog && !main.contains(document.activeElement)) {
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }
      setMessage(document.title.replace(/ · Plannr$/, ""));
    };
    // Wait for the new screen's content, then one more frame for its title to be set.
    const settle = () => {
      if (!document.getElementById("main") && frames++ < MAX_FRAMES) frame = requestAnimationFrame(settle);
      else frame = requestAnimationFrame(announce);
    };
    frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
