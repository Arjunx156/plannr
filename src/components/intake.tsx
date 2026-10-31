import { type ReactNode, useRef } from "react";
import type { Profile } from "../data/types";
import { PRIORITY_OPTIONS } from "../lib/intakeQuestions";

/** Plannr can draft once it knows the type, place, date, headcount and budget. */
export function canDraft(p: Profile): boolean {
  return !!(p.kind && p.city && p.date && p.guests && p.budget);
}

export function PriorityPicker({
  profile,
  onToggle,
}: {
  profile: Profile;
  onToggle: (option: string, list: "priorities" | "cuts") => void;
}) {
  const options = PRIORITY_OPTIONS[profile.kind ?? "other"];
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs font-medium tracking-[0.06em] text-muted uppercase">
        Most important · {profile.priorities.length} of 3
      </span>
      <div className="flex flex-wrap gap-2">
        {options.most.map((o) => {
          const rank = profile.priorities.indexOf(o);
          const full = profile.priorities.length >= 3 && rank < 0;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={rank >= 0}
              disabled={full}
              onClick={() => onToggle(o, "priorities")}
              className="chip disabled:opacity-50"
            >
              {rank >= 0 ? `${rank + 1} · ${o}` : o}
            </button>
          );
        })}
      </div>
      <span className="mt-1.5 font-mono text-xs font-medium tracking-[0.06em] text-muted uppercase">
        Okay to cut
      </span>
      <div className="flex flex-wrap gap-2">
        {options.cut.map((o) => {
          const on = profile.cuts.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o, "cuts")}
              className={`inline-flex min-h-9 items-center rounded-full border px-[13px] text-sm font-medium ${on ? "border-gold bg-cream text-amber-ink" : "border-line bg-surface hover:border-line-2"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** An inspiration image picked on this phone. The plan keeps only its name; the picture stays here. */
export type ImagePreview = { name: string; url: string };

/** Previews for the images among picked or dropped files. */
export function imagesFrom(files: Iterable<File> | null): ImagePreview[] {
  return [...(files ?? [])]
    .filter((f) => f.type.startsWith("image/"))
    .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
}

/** One inspiration: the picture when this phone has it, else its file name or link. */
export function InspirationTile({
  name,
  url,
  className,
}: {
  name: string;
  url?: string | undefined;
  className: string;
}) {
  return (
    <div
      className={`hatch relative flex items-end overflow-hidden font-mono leading-[1.2] font-medium text-muted ${className}`}
    >
      {url ? (
        <img src={url} alt={name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="break-all">{name.replace(/^https?:\/\//, "")}</span>
      )}
    </div>
  );
}

/** A dashed button that opens the photo picker, and takes images dropped on it. */
export function AddImages({
  onAdd,
  className,
  children,
}: {
  onAdd: (files: FileList) => void;
  className: string;
  children: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && onAdd(e.target.files)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onAdd(e.dataTransfer.files);
        }}
        className={`border-[1.5px] border-dashed border-line-2 font-medium text-body hover:border-ink ${className}`}
      >
        {children}
      </button>
    </>
  );
}
