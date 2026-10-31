import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useStore } from "../store/store";

/** Native <dialog>: focus trap, Escape and backdrop come for free. */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 480,
  label,
  side = "center",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: number;
  label?: string;
  /** "right": a full-height sheet for working on one record beside the page. */
  side?: "center" | "right";
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
      className={`${side === "right" ? "m-0 ml-auto h-dvh max-h-dvh w-full rounded-none" : "m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] rounded-2xl"} overflow-auto border-0 bg-surface p-0 text-ink shadow-[0_1px_2px_rgba(0,0,0,.06),0_16px_48px_rgba(60,40,20,.18)] backdrop:bg-[rgba(31,27,22,.45)]`}
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
          className={`rise absolute top-[calc(100%+6px)] z-30 flex min-w-[210px] flex-col rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(40,25,10,.16)] ${align === "right" ? "right-0" : "left-0"}`}
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
