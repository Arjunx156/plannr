import type { JSX } from "react";
import { cssVars, percent } from "../../../components/cssVars";
import type { Category } from "../../../data/budgetTypes";

/** The plan in grey, spending over it (rust once the line is heading over), and the overrun shaded past it. */
export function SpendBar({ c, max }: { c: Category; max: number }): JSX.Element {
  const proj = c.projected ?? c.planned;
  const over = proj > c.planned;
  return (
    <span className="relative block h-2 rounded-[2px] bg-sand-2">
      <span
        ref={cssVars({ "--w": percent(c.planned / max) })}
        className="absolute inset-y-0 left-0 w-(--w) rounded-[2px] bg-line-2"
      />
      <span
        ref={cssVars({ "--w": percent(c.spent / max) })}
        className={`absolute inset-y-0 left-0 w-(--w) rounded-[2px] ${over ? "bg-rust" : "bg-leaf"}`}
      />
      {over && (
        <span
          ref={cssVars({ "--x": percent(c.planned / max), "--w": percent((proj - c.planned) / max) })}
          className="absolute inset-y-0 left-(--x) w-(--w) rounded-r-[2px] bg-rust opacity-40"
        />
      )}
    </span>
  );
}
