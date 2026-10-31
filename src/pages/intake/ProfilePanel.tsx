import type { JSX } from "react";
import { AddImages, type ImagePreview, InspirationTile } from "../../components/intake";
import { Bar } from "../../components/ui";
import type { Profile } from "../../data/types";
import type { QuestionField } from "../../lib/intakeQuestions";
import { profileRows } from "../../lib/profileRows";

/** The small diamond that marks something Gemini filled in. */
export function AiMark(): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-peacock text-white text-xs"
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
  asking?: QuestionField | undefined;
  images: ImagePreview[];
  onAdd: (f: FileList | null) => void;
  onEdit: () => void;
}): JSX.Element {
  const rows = profileRows(profile, asking);
  const known = rows.filter((r) => r.state === "ok").length;
  const tiles = profile.inspiration.slice(0, 5);
  return (
    <aside
      aria-label="What Plannr understood"
      className="flex flex-col gap-3.5 border-line border-t bg-surface p-5 sm:p-7 lg:border-t-0 lg:border-l"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl leading-none">What I've understood</h2>
        <button type="button" className="link text-xs" onClick={onEdit}>
          Edit any
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <Bar
          value={known / 10}
          fill="peacock"
          label="How much of the brief Plannr knows"
          className="flex-1"
        />
        <span className="font-medium text-body text-xs">{known} of 10</span>
      </div>
      <dl className="m-0 flex flex-col">
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-[18px_112px_minmax(0,1fr)] items-start gap-2 border-sand-2 border-t py-[9px] text-sm leading-[1.4]"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full font-bold text-[10px] text-white ${DOT[r.state].bg}`}
            >
              {DOT[r.state].mark}
            </span>
            <dt className="text-muted">{r.label}</dt>
            <dd className={`m-0 ${DOT[r.state].text}`}>{r.value || "Not yet"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-0.5 grid grid-cols-3 gap-1.5">
        {tiles.map((name) => (
          <InspirationTile
            key={name}
            name={name}
            url={images.find((i) => i.name === name)?.url}
            className="aspect-square rounded-lg p-1.5 text-[9px]"
          />
        ))}
        <AddImages
          onAdd={onAdd}
          className="flex aspect-square items-center justify-center rounded-lg text-xs hover:text-ink"
        >
          + Add
        </AddImages>
      </div>
    </aside>
  );
}
