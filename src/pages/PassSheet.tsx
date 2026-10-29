import { Link, useParams } from "react-router";
import { QrCode } from "../components/qr";
import { usePageMeta } from "../components/ui";
import { longDate } from "../lib/dates";
import { passCode } from "../shared/public";
import { list } from "../shared/records";
import { useStore } from "../store/store";

/**
 * /events/:id/passes — every pass on one printable sheet, each with its QR code. Cut them
 * apart and hand them out; the gate team scans them from the gate link or the Day of tab.
 */
export function PassSheet() {
  const { id } = useParams();
  const { state } = useStore();
  const ev = state.events.find((e) => e.id === id);
  usePageMeta(ev ? `Passes · ${ev.name}` : "Passes", { private: true });
  const passes = ev ? list(ev, "passes") : [];
  return (
    <div className="min-h-dvh bg-paper px-4 py-6 text-ink print:bg-white print:p-0">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-col gap-1">
            <Link to={`/events/${id}/stalls`} className="link text-sm">
              ← Stalls & passes
            </Link>
            <h1 className="font-serif text-[32px] leading-none">Passes{ev ? ` · ${ev.name}` : ""}</h1>
            <span className="text-sm text-body">
              {passes.length} {passes.length === 1 ? "pass" : "passes"}. Print, cut along the lines, and hand
              them out.
            </span>
          </div>
          {passes.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              Print
            </button>
          )}
        </div>
        {!ev ? (
          <p className="m-0 text-body">This event isn't on this device.</p>
        ) : !passes.length ? (
          <p className="m-0 text-body">No passes issued yet. Issue them on the Stalls & passes page.</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-2 gap-0 p-0 sm:grid-cols-3 print:grid-cols-3">
            {passes.map((p) => (
              <li
                key={p.id}
                className="flex break-inside-avoid flex-col items-center gap-1.5 border border-dashed border-line-2 p-4 text-center"
              >
                <span className="eyebrow text-muted">{ev.name}</span>
                <QrCode text={passCode(p.id)} size={132} label={`Pass for ${p.name}`} />
                <span className="font-serif text-[20px] leading-tight">{p.name}</span>
                <span className="text-sm text-body">
                  Admits {p.count} · {longDate(ev.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
