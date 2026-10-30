import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { Field } from "../../components/ui";
import type { PlannrEvent } from "../../data/types";
import { aiEnabled, aiRead, aiWrite, type ReadResult, type WriteTask } from "../../lib/ai";
import { api, publicUrl } from "../../lib/api";
import { longDate } from "../../lib/dates";
import { linkExpiry, type PublicKind } from "../../shared/public";
import { toast, useStore } from "../../store/store";

export { QrCode } from "../../components/qr";
export { parseAmount } from "../../lib/format";

/** A tab's page: an eyebrow with the event name, a heading and whatever sits beside it. */
export function TabPage({
  eyebrow,
  title,
  aside,
  children,
  wide,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      id="main"
      className={`mx-auto flex ${wide ? "max-w-[1180px]" : "max-w-[960px]"} flex-col gap-6 px-4 py-8 sm:px-8`}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-muted">{eyebrow}</span>
          <h1 className="font-serif text-[40px] leading-none">{title}</h1>
        </div>
        {aside}
      </div>
      {children}
    </main>
  );
}

export function Section({
  title,
  aside,
  children,
  label,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  return (
    <section
      aria-label={label ?? title}
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
    >
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="font-serif text-[24px] leading-tight">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="eyebrow text-muted">{label}</span>
      <span className={`font-serif text-[28px] leading-none tabular ${tone ?? ""}`}>{value}</span>
      {sub && <span className="text-xs text-body">{sub}</span>}
    </div>
  );
}

let seq = 0;
/** A new record id: short, unique enough for one plan, and readable in history. */
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

/** A WhatsApp link with the message filled in, to one number or to whoever they pick. */
export function waLink(text: string, phone?: string): string {
  const to = phone?.replace(/\D/g, "") ?? "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** A UPI payment link that opens any UPI app on the phone. */
export function upiLink(vpa: string, name: string, amount: number, note: string): string {
  const q = new URLSearchParams({
    pa: vpa,
    pn: name,
    am: String(Math.round(amount)),
    cu: "INR",
    tn: note.slice(0, 60),
  });
  return `upi://pay?${q.toString()}`;
}

/**
 * A shared link for one page. With an account it's a real link anyone can open; in the demo
 * it opens a preview drawn from this browser's plan.
 */
export function useShareLink(ev: PlannrEvent, kind: PublicKind, target = "") {
  const { state, dispatch } = useStore();
  const account = state.mode === "account";
  const preview = `/preview/${kind}/${ev.id}${target ? `/${encodeURIComponent(target)}` : ""}`;
  const get = async (): Promise<string | undefined> => {
    if (!account) return undefined;
    try {
      const link = await api.linkFor(ev.id, kind, target);
      return publicUrl(kind, link.token);
    } catch (e) {
      dispatch(toast(`Couldn't make the link: ${(e as Error).message}`));
      return undefined;
    }
  };
  return { account, preview, get };
}

/** Copy and WhatsApp buttons for a shared page, with a preview in the demo. */
export function ShareLink({
  ev,
  kind,
  target,
  message,
  phone,
  label = "Share",
  onShared,
}: {
  ev: PlannrEvent;
  kind: PublicKind;
  target?: string;
  /** The WhatsApp message; the link is added at the end. */
  message: string;
  phone?: string;
  label?: string;
  onShared?: () => void;
}) {
  const { dispatch } = useStore();
  const share = useShareLink(ev, kind, target);
  const [busy, setBusy] = useState(false);
  if (!share.account)
    return (
      <span className="flex flex-wrap gap-1.5">
        <Link to={share.preview} className="btn btn-ghost btn-sm">
          Preview
        </Link>
        {onShared && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            title="In the demo nothing is sent; this marks it as done"
            onClick={() => {
              onShared();
              dispatch(toast(`${label === "Remind" ? "Reminder" : "Invitation"} marked as sent.`));
            }}
          >
            Mark {label === "Remind" ? "reminded" : "sent"}
          </button>
        )}
      </span>
    );
  const whatsapp = async () => {
    // Open the tab first, synchronously, so the browser doesn't block it as a popup. Passing
    // "noopener" would make window.open return null and lose the tab, so instead its link back
    // to Plannr is cut here, before it loads anything.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    setBusy(true);
    const url = await share.get();
    setBusy(false);
    if (!url) {
      win?.close();
      return;
    }
    const link = waLink(`${message}\n${url}`, phone);
    if (win) win.location.href = link;
    else window.location.href = link;
    onShared?.();
  };
  const copy = async () => {
    setBusy(true);
    const url = await share.get();
    setBusy(false);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      dispatch(toast("Link copied."));
      onShared?.();
    } catch {
      window.prompt("Copy this link", url);
    }
  };
  return (
    <span className="flex flex-wrap gap-1.5">
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={whatsapp}>
        {label} on WhatsApp
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={copy}
        aria-label={`Copy the ${kind} link`}
        title={`Works until ${longDate(linkExpiry(ev, kind))}`}
      >
        Copy link
      </button>
      <Link to={share.preview} className="btn btn-ghost btn-sm">
        Preview
      </Link>
    </span>
  );
}

/** Whether the server has AI switched on; undefined while asking. */
export function useAiOn(): boolean | undefined {
  const [on, setOn] = useState<boolean>();
  useEffect(() => {
    let live = true;
    aiEnabled().then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  return on;
}

/**
 * A message Plannr can draft: a vendor enquiry, a thank-you, a permit letter. It starts from
 * a plain template that works offline, and "Write it for me" asks the model for a better one.
 * Nothing is sent from here; the family sends it from WhatsApp or copies it.
 */
export function DraftBox({
  task,
  context,
  fallback,
  phone,
  lang,
  onSave,
  saveLabel = "Save",
  rows = 6,
}: {
  task: WriteTask;
  context: Record<string, unknown>;
  fallback: string;
  phone?: string;
  lang?: string;
  onSave?: (text: string) => void;
  saveLabel?: string;
  rows?: number;
}) {
  const { dispatch } = useStore();
  const ai = useAiOn();
  const id = useId();
  const [text, setText] = useState(fallback);
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState(lang ?? "en");
  const write = async () => {
    setBusy(true);
    const out = await aiWrite({ task, lang: language, text, context });
    setBusy(false);
    if (out) setText(out);
    else dispatch(toast("Plannr couldn't write that just now. The draft is still yours to edit."));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      dispatch(toast("Copied."));
    } catch {
      window.prompt("Copy this", text);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        Draft
      </label>
      <textarea
        id={id}
        className="field py-2 text-sm leading-relaxed"
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {ai && (
          <>
            <label className="sr-only" htmlFor={`${id}-lang`}>
              Language
            </label>
            <select
              id={`${id}-lang`}
              className="field h-8 w-auto py-0 text-xs"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="ml">Malayalam</option>
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
            </select>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={write}>
              {busy ? "Writing…" : "Write it for me"}
            </button>
          </>
        )}
        <a
          href={waLink(text, phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
        >
          Open in WhatsApp
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
          Copy
        </button>
        {onSave && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSave(text)}>
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * "Read a bill or quote": a photo or PDF in, the amounts and terms out, for the person to
 * check before anything is added. Shown only when the server has AI.
 */
export function ReadDocument({
  label = "Read a bill or quote",
  categories,
  guests,
  onRead,
}: {
  label?: string;
  categories: string[];
  guests?: number;
  onRead: (r: ReadResult) => void;
}) {
  const { dispatch } = useStore();
  const ai = useAiOn();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!ai) return null;
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onRead(await aiRead(file, { categories, guests }));
    } catch (e) {
      dispatch(toast((e as Error).message));
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Reading…" : label}
      </button>
    </>
  );
}

/**
 * The "What for" and "Amount (₹)" fields every money form starts with. `beside` sits next to
 * the amount (a due date, who paid); ids are prefixed with `id` so two forms can share a page.
 */
export function WhatForAmount({
  id,
  label,
  amount,
  placeholder,
  onChange,
  beside,
}: {
  id: string;
  label: string;
  amount: string;
  placeholder: string;
  onChange: (patch: { label?: string; amount?: string }) => void;
  beside: ReactNode;
}) {
  return (
    <>
      <Field label="What for" htmlFor={`${id}-label`}>
        <input
          id={`${id}-label`}
          className="field"
          value={label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={placeholder}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)" htmlFor={`${id}-amount`}>
          <input
            id={`${id}-amount`}
            className="field"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onChange({ amount: e.target.value })}
          />
        </Field>
        {beside}
      </div>
    </>
  );
}

/** Picks a budget category; `none` names the empty choice ("None", "The vendor's category"). */
export function CategorySelect({
  id,
  categories,
  value,
  onChange,
  none = "None",
  hint,
}: {
  id: string;
  categories: { id: string; name: string }[];
  value: string;
  onChange: (categoryId: string) => void;
  none?: string;
  hint?: string;
}) {
  return (
    <Field label="Budget category" htmlFor={id} hint={hint}>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{none}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
