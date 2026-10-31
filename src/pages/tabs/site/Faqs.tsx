import { type FormEvent, useState } from "react";
import type { SiteInfo } from "../../../data/recordTypes";
import { Section } from "../layout";

export function Faqs({
  site,
  editable,
  onSave,
}: {
  site: SiteInfo;
  editable: boolean;
  onSave: (p: Partial<SiteInfo>, m?: string) => void;
}) {
  const faqs = site.faqs ?? [];
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim() || !a.trim()) return;
    onSave({ faqs: [...faqs, { q: q.trim(), a: a.trim() }] }, "Added the question.");
    setQ("");
    setA("");
  };
  return (
    <Section title="Questions guests ask">
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {faqs.map((f, i) => (
          <li
            key={f.q}
            className="flex items-start justify-between gap-3 border-t border-sand-2 pt-2.5 first:border-0 first:pt-0"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{f.q}</span>
              <span className="text-sm text-body">{f.a}</span>
            </div>
            {editable && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-rust-ink"
                aria-label={`Remove “${f.q}”`}
                onClick={() => onSave({ faqs: faqs.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {faqs.length === 0 && (
          <li className="text-sm text-muted">Parking, dress code, children, gifts: answer them once here.</li>
        )}
      </ul>
      {editable && (
        <form onSubmit={add} className="flex flex-col gap-2">
          <label htmlFor="faq-q" className="sr-only">
            Question
          </label>
          <input
            id="faq-q"
            className="field"
            placeholder="Question"
            value={q}
            maxLength={200}
            onChange={(e) => setQ(e.target.value)}
          />
          <label htmlFor="faq-a" className="sr-only">
            Answer
          </label>
          <textarea
            id="faq-a"
            className="field min-h-16 py-2"
            placeholder="Answer"
            value={a}
            maxLength={1000}
            onChange={(e) => setA(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-secondary btn-sm self-start"
            disabled={!q.trim() || !a.trim()}
          >
            Add question
          </button>
        </form>
      )}
    </Section>
  );
}
