import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import type { Person, Tone } from "../data/types";
import { useStore } from "../store/store";

export function Logo({
  size = 26,
  tone = "ink",
  to,
}: {
  size?: number;
  tone?: "ink" | "light";
  to?: string;
}) {
  const body = (
    <span className="inline-flex items-center gap-2">
      <span
        className={`font-serif italic leading-none ${tone === "light" ? "text-white" : "text-ink"}`}
        style={{ fontSize: size, letterSpacing: "-0.01em" }}
      >
        Plannr
      </span>
      <span
        aria-hidden="true"
        className="rounded-full bg-marigold"
        style={{ width: size > 28 ? 8 : 7, height: size > 28 ? 8 : 7, marginTop: size > 28 ? 10 : 8 }}
      />
    </span>
  );
  if (!to) return body;
  return (
    <Link to={to} aria-label="Plannr home" className="no-underline">
      {body}
    </Link>
  );
}

export function Toran({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "beads";
  className?: string;
}) {
  const cls =
    size === "lg" ? "toran-lg" : size === "md" ? "toran-md" : size === "beads" ? "toran-beads" : "toran";
  return <div aria-hidden="true" className={`${cls} ${className}`} />;
}

export function Kolam({ className = "kolam", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} style={style} />
  );
}

export function Bar({
  value,
  color = "var(--color-ink)",
  height = 6,
  label,
}: {
  value: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className="bar"
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const TONE_TEXT: Record<Tone, string> = {
  warn: "text-rust-ink",
  due: "text-amber-ink",
  ok: "text-leaf-ink",
  idle: "text-muted",
};

export function toneText(t: Tone): string {
  return TONE_TEXT[t];
}

export function Pill({ tone, children }: { tone: Tone | "ai"; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Avatar({ p, size = 30, ring = true }: { p: Person; size?: number; ring?: boolean }) {
  return (
    <span
      title={p.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: p.bg,
        color: p.fg,
        fontSize: size > 32 ? 13 : 11,
        border: ring ? "2px solid var(--color-paper)" : undefined,
      }}
    >
      {p.initials}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  if (!label) return <span className="spinner" aria-hidden="true" />;
  return <span className="spinner" role="status" aria-label={label} />;
}

/** Native <dialog>: focus trap, Escape and backdrop come for free. */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 480,
  label,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: number;
  label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : label}
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] overflow-auto rounded-2xl border-0 bg-white p-0 text-ink shadow-[0_1px_2px_rgba(0,0,0,.06),0_16px_48px_rgba(60,40,20,.18)] backdrop:bg-[rgba(31,27,22,.45)]"
      style={{ maxWidth: width }}
    >
      {open && (
        <div className="flex flex-col gap-3.5 p-[22px]">
          {title && (
            <div className="flex items-center justify-between gap-4">
              <h2 id={titleId} className="font-serif text-[22px] leading-none">
                {title}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm -mr-2"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Small popover menu that closes on outside click and Escape. */
export function Menu({
  button,
  children,
  align = "right",
  label,
  className = "",
}: {
  button: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      {button({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={`rise absolute top-[calc(100%+6px)] z-30 flex min-w-[210px] flex-col rounded-xl border border-line bg-white p-1.5 shadow-[0_12px_32px_rgba(40,25,10,.16)] ${align === "right" ? "right-0" : "left-0"}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  disabled,
  hint,
}: {
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={hint}
      onClick={onSelect}
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-sand disabled:text-muted disabled:hover:bg-transparent ${danger ? "text-rust-ink" : ""}`}
    >
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <span aria-hidden="true" className="mx-1.5 my-1 h-px bg-line" />;
}

export function Toasts() {
  const { state, dispatch } = useStore();
  const latest = state.toasts[state.toasts.length - 1];
  useEffect(() => {
    if (!latest) return;
    const t = window.setTimeout(() => dispatch({ type: "dismissToast", id: latest.id }), 5000);
    return () => window.clearTimeout(t);
  }, [latest, dispatch]);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
    >
      {latest && (
        <div
          key={latest.id}
          className="rise pointer-events-auto flex max-w-[520px] items-center gap-4 rounded-xl bg-ink px-4 py-3 text-sm text-paper shadow-[0_12px_32px_rgba(40,25,10,.3)]"
        >
          <span>{latest.text}</span>
          {latest.undo && (
            <button
              type="button"
              className="font-semibold text-gold underline-offset-4 hover:underline"
              onClick={() => {
                if (latest.undo) dispatch(latest.undo);
                dispatch({ type: "dismissToast", id: latest.id });
              }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="text-stone hover:text-white"
            onClick={() => dispatch({ type: "dismissToast", id: latest.id })}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

/** Sets the tab title and description for the current screen. */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title =
      title === "Plannr" ? "Plannr · Describe the day, get a plan you can run" : `${title} · Plannr`;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
}
