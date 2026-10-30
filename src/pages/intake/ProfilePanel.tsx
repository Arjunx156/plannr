import { useRef } from "react";
import type { Profile } from "../../data/types";
import { profileRows, type QuestionField } from "../../lib/intake";

export function AiMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-peacock text-xs text-white"
    >
      ◆
    </span>
  );
}

const DOT: Record<"ok" | "ask" | "todo", { bg: string; mark: string; text: string }> = {
  ok: { bg: "bg-leaf", mark: "✓", text: "text-ink" },
  ask: { bg: "bg-peacock", mark: "?", text: "text-peacock" },
  todo: { bg: "bg-line-2", mark: "", text: "text-muted" },
};

/** What Plannr has understood so far, beside the chat, with what it still needs. */
export function ProfilePanel({
  profile,
  asking,
  images,
  onAdd,
  onEdit,
}: {
  profile: Profile;
  asking?: QuestionField;
  images: { name: string; url: string }[];
  onAdd: (f: FileList | null) => void;
  onEdit: () => void;
}) {
  const rows = profileRows(profile, asking);
  const known = rows.filter((r) => r.state === "ok").length;
  const fileRef = useRef<HTMLInputElement>(null);
  const tiles = profile.inspiration.slice(0, 5);
  return (
    <aside
      aria-label="What Plannr understood"
      className="flex flex-col gap-3.5 border-t border-line bg-surface p-5 sm:p-7 lg:border-t-0 lg:border-l"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl leading-none">What I've understood</h2>
        <button type="button" className="link text-xs" onClick={onEdit}>
          Edit any
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="bar flex-1" style={{ height: 5 }}>
          <span style={{ width: `${known * 10}%`, background: "var(--color-peacock)" }} />
        </div>
        <span className="text-xs font-medium text-body">{known} of 10</span>
      </div>
      <dl className="m-0 flex flex-col">
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-[18px_112px_minmax(0,1fr)] items-start gap-2 border-t border-sand-2 py-[9px] text-sm leading-[1.4]"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${DOT[r.state].bg}`}
            >
              {DOT[r.state].mark}
            </span>
            <dt className="text-muted">{r.label}</dt>
            <dd className={`m-0 ${DOT[r.state].text}`}>{r.value || "Not yet"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-0.5 grid grid-cols-3 gap-1.5">
        {tiles.map((name) => {
          const img = images.find((i) => i.name === name);
          return (
            <div
              key={name}
              className="hatch relative flex aspect-square items-end overflow-hidden rounded-lg p-1.5 font-mono text-[9px] leading-[1.2] font-medium text-muted"
            >
              {img && (
                <img src={img.url} alt={name} className="absolute inset-0 h-full w-full object-cover" />
              )}
              {!img && <span className="break-all">{name.replace(/^https?:\/\//, "")}</span>}
            </div>
          );
        })}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onAdd(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-square items-center justify-center rounded-lg border-[1.5px] border-dashed border-line-2 text-xs font-medium text-body hover:border-ink hover:text-ink"
        >
          + Add
        </button>
      </div>
    </aside>
  );
}
