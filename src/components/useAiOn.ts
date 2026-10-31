import { useEffect, useState } from "react";
import { aiEnabled } from "../lib/ai";

/** Whether the server has AI switched on; undefined while asking. */
export function useAiOn(): boolean | undefined {
  const [on, setOn] = useState<boolean>();
  useEffect(() => {
    let live = true;
    // aiEnabled settles to false when the server can't be reached; it never rejects.
    void aiEnabled().then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  return on;
}
