import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/** A new screen starts at the top, as a page load would. Going back leaves the scroll to the browser. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (type !== "POP") window.scrollTo(0, 0);
  }, [pathname, type]);

  return null;
}
