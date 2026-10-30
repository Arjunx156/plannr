import { type ReactNode, useRef, useState } from "react";
import { PriorityPicker } from "../../components/intake";
import type { Kind, Profile } from "../../data/types";
import { addDays, longDate, TODAY } from "../../lib/dates";
import { inr } from "../../lib/format";
import { KIND_LABEL, togglePick } from "../../lib/intake";
import { TEMPLATES, type TemplateId, templateProfile } from "../../lib/templates";
import { useStore } from "../../store/store";

/** Functions a planner can pick for each kind of event. */
const FUNCTION_CHOICES: Record<Kind, string[]> = {
  wedding: ["Engagement", "Mehendi", "Haldi", "Sangeet", "Ceremony", "Reception"],
  birthday: ["Party", "Cake cutting", "Games", "Dinner"],
  community: ["Stalls", "Cultural night", "Contest", "Food court", "Puja"],
  other: ["Ceremony", "Lunch", "Dinner", "Get-together"],
};

const NEEDS = [
  "Vegetarian",
  "Wheelchair access",
  "Allergies to note",
  "Elderly guests",
  "Kids' area",
  "Guest stay",
];
const MOODS = ["Temple-inspired", "Elegant", "Warm", "Grand", "Minimal", "Vibrant", "Garden", "Modern"];
const COLOURS: { name: string; hex: string }[] = [
  { name: "Kasavu gold", hex: "#D6B15E" },
  { name: "Ivory", hex: "#F4EEDF" },
  { name: "Mango leaf", hex: "#3D7A4F" },
  { name: "Kumkum", hex: "#A8322A" },
  { name: "Peacock", hex: "#1F5F6B" },
];

function Chips({
  options,
  selected,
  onToggle,
  single,
}: {
  options: string[];
  selected: string[];
  onToggle: (o: string) => void;
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={selected.includes(o)}
          onClick={() => onToggle(o)}
          className={`chip min-h-10 px-3.5 ${single && selected.includes(o) ? "border-ink bg-ink text-paper" : ""}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Block({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm leading-none font-semibold">
          {label}
        </label>
      ) : (
        <span className="text-sm leading-none font-semibold">{label}</span>
      )}
      {children}
    </div>
  );
}

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Adds to a list once. */
const addOnce = (list: string[], v: string) => [...new Set([...list, v])];

type ImagePreview = { name: string; url: string };

interface StepProps {
  p: Profile;
  set: (patch: Partial<Profile>) => void;
  /** Inspiration images chosen on this device, kept while the planner moves between steps. */
  previews: ImagePreview[];
  addPreviews: (added: ImagePreview[]) => void;
}

function KindStep({ p, set }: StepProps) {
  const { dispatch } = useStore();
  const label = (k: Kind) => (k === "other" ? "Something else" : KIND_LABEL[k]);
  return (
    <div className="flex flex-col gap-7">
      <Block label="Event type">
        <Chips
          single
          options={(Object.keys(KIND_LABEL) as Kind[]).map(label)}
          selected={p.kind ? [label(p.kind)] : []}
          onToggle={(o) => {
            const kind = (Object.keys(KIND_LABEL) as Kind[]).find((k) => label(k) === o) ?? "other";
            // A wedding always has its ceremony; the planner adds the rest.
            set({ kind, functions: kind === "wedding" && !p.functions.length ? ["Ceremony"] : p.functions });
          }}
        />
      </Block>
      <Block label="Style or theme" htmlFor="style">
        <input
          id="style"
          className="field max-w-[420px]"
          placeholder="Kerala-style, space theme, garden party…"
          value={p.style ?? ""}
          onChange={(e) => set({ style: e.target.value || undefined })}
        />
      </Block>
      <Block label="Or start from a template">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
            <button
              key={id}
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                dispatch({ type: "draft", patch: { profile: templateProfile(id), guidedStep: 0 } })
              }
            >
              {TEMPLATES[id].label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">
          A template fills every step. Change anything that's different for you.
        </span>
      </Block>
    </div>
  );
}

function FunctionsStep({ p, set }: StepProps) {
  return (
    <Block label="Functions">
      <Chips
        options={FUNCTION_CHOICES[p.kind ?? "other"]}
        selected={p.functions}
        onToggle={(o) => set({ functions: toggle(p.functions, o) })}
      />
    </Block>
  );
}

function DateStep({ p, set }: StepProps) {
  return (
    <Block label="Main day" htmlFor="date">
      <input
        id="date"
        type="date"
        className="field max-w-[260px]"
        min={addDays(TODAY, 1)}
        value={p.date ?? ""}
        onChange={(e) =>
          set({
            date: e.target.value || undefined,
            dateText: e.target.value ? longDate(e.target.value) : undefined,
          })
        }
      />
      {p.dateText && <span className="text-xs text-peacock">◆ Tasks will work back from {p.dateText}.</span>}
    </Block>
  );
}

function PlaceStep({ p, set }: StepProps) {
  const named = p.venueStatus && p.venueStatus !== "Not started";
  return (
    <div className="flex flex-col gap-7">
      <Block label="City or neighbourhood" htmlFor="g-city">
        <input
          id="g-city"
          className="field max-w-[420px]"
          placeholder="Kochi"
          value={p.city ?? ""}
          onChange={(e) => set({ city: e.target.value || undefined })}
        />
      </Block>
      <Block label="Venue">
        <Chips
          single
          options={["Booked", "Shortlisted", "Not started"]}
          selected={p.venueStatus ? [p.venueStatus] : []}
          onToggle={(o) => set({ venueStatus: o as Profile["venueStatus"] })}
        />
      </Block>
      {named && (
        <Block label={p.venueStatus === "Booked" ? "Which venue?" : "Which venues?"} htmlFor="venues">
          <input
            id="venues"
            className="field max-w-[520px]"
            placeholder="Kayal Heritage Centre or Lotus Banquets"
            value={p.venues ?? ""}
            onChange={(e) => set({ venues: e.target.value || undefined })}
          />
        </Block>
      )}
    </div>
  );
}

/** Quick picks for a number, each pressed when it's the current value. */
function QuickPicks({
  values,
  current,
  label = String,
  onPick,
}: {
  values: number[];
  current: number | undefined;
  label?: (n: number) => string;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((n) => (
        <button
          key={n}
          type="button"
          className="chip chip-sm"
          aria-pressed={current === n}
          onClick={() => onPick(n)}
        >
          {label(n)}
        </button>
      ))}
    </div>
  );
}

function GuestsStep({ p, set }: StepProps) {
  return (
    <Block label="Guests" htmlFor="guests">
      <input
        id="guests"
        type="number"
        inputMode="numeric"
        min={1}
        className="field max-w-[200px]"
        value={p.guests ?? ""}
        onChange={(e) => set({ guests: Number(e.target.value) || undefined })}
      />
      <QuickPicks values={[30, 50, 100, 250, 500]} current={p.guests} onPick={(guests) => set({ guests })} />
    </Block>
  );
}

function BudgetStep({ p, set }: StepProps) {
  return (
    <Block label="Total budget in rupees" htmlFor="budget">
      <div className="field max-w-[280px] gap-2">
        <span className="text-body">₹</span>
        <input
          id="budget"
          type="number"
          inputMode="numeric"
          min={1000}
          step={1000}
          className="min-w-0 flex-1 bg-transparent outline-none"
          value={p.budget ?? ""}
          onChange={(e) => set({ budget: Number(e.target.value) || undefined })}
        />
      </div>
      {p.budget ? <span className="text-xs text-peacock">◆ {inr(p.budget)}</span> : null}
      <QuickPicks
        values={[40000, 250000, 500000, 1000000, 1800000]}
        current={p.budget}
        label={inr}
        onPick={(budget) => set({ budget })}
      />
    </Block>
  );
}

function NeedsStep({ p, set }: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <Block label="Traditions" htmlFor="traditions">
        <input
          id="traditions"
          className="field max-w-[560px]"
          placeholder="Sadhya on banana leaf, nilavilakku lighting"
          value={p.traditions ?? ""}
          onChange={(e) => set({ traditions: e.target.value || undefined })}
        />
      </Block>
      <Block label="Needs">
        <Chips
          options={[...new Set([...NEEDS, ...p.needs])]}
          selected={p.needs}
          onToggle={(o) => set({ needs: toggle(p.needs, o) })}
        />
      </Block>
    </div>
  );
}

function MoodWords({ p, set }: StepProps) {
  const [own, setOwn] = useState("");
  return (
    <Block label="Mood words">
      <div className="flex flex-wrap gap-2">
        {[...new Set([...MOODS, ...p.moods])].map((m) => (
          <button
            key={m}
            type="button"
            className="chip min-h-10 px-3.5"
            aria-pressed={p.moods.includes(m)}
            onClick={() => set({ moods: toggle(p.moods, m) })}
          >
            {m}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (own.trim()) set({ moods: addOnce(p.moods, own.trim()) });
            setOwn("");
          }}
          className="inline-flex"
        >
          <label htmlFor="own-mood" className="sr-only">
            Your own mood word
          </label>
          <input
            id="own-mood"
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            placeholder="+ Your own"
            className="min-h-10 w-[130px] rounded-full border border-dashed border-line-2 bg-transparent px-3.5 text-sm outline-none focus:border-solid focus:border-ink"
          />
        </form>
      </div>
    </Block>
  );
}

function Colours({ p, set }: StepProps) {
  const picker = useRef<HTMLInputElement>(null);
  const picked = p.colours.filter((c) => c.startsWith("#")).map((hex) => ({ name: hex, hex }));
  return (
    <Block label="Colours">
      <div className="flex flex-wrap gap-3.5">
        {[...COLOURS, ...picked].map((c) => {
          const on = p.colours.includes(c.name);
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={on}
              onClick={() => set({ colours: toggle(p.colours, c.name) })}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className="h-[60px] w-[60px] rounded-xl border border-line"
                style={{
                  background: c.hex,
                  outline: on ? "2px solid var(--color-ink)" : undefined,
                  outlineOffset: 3,
                }}
              />
              <span className={`text-xs font-medium ${on ? "text-ink" : "text-body"}`}>{c.name}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="flex flex-col items-center gap-1.5"
        >
          <span className="flex h-[60px] w-[60px] items-center justify-center rounded-xl border-[1.5px] border-dashed border-line-2 font-serif text-[22px] text-body">
            +
          </span>
          <span className="text-xs font-medium text-body">Pick</span>
        </button>
        <input
          ref={picker}
          type="color"
          className="sr-only"
          tabIndex={-1}
          aria-label="Pick a colour"
          onChange={(e) => set({ colours: addOnce(p.colours, e.target.value.toUpperCase()) })}
        />
      </div>
    </Block>
  );
}

function Inspiration({ p, set, previews, addPreviews }: StepProps) {
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  /** Previews chosen or dropped images on this device; the profile keeps their names. */
  const addImages = (files: Iterable<File>) => {
    const added = [...files]
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    addPreviews(added);
    set({ inspiration: [...p.inspiration, ...added.map((a) => a.name)] });
  };
  return (
    <Block label="Inspiration">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]">
        {p.inspiration.slice(-3).map((name) => {
          const img = previews.find((i) => i.name === name);
          return (
            <div
              key={name}
              className="hatch relative flex h-[110px] items-end overflow-hidden rounded-[10px] p-2 font-mono text-[10px] leading-[1.2] font-medium break-all text-muted"
            >
              {img ? (
                <img src={img.url} alt={name} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                name
              )}
            </div>
          );
        })}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addImages(e.target.files ?? [])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addImages(e.dataTransfer.files);
          }}
          className="flex h-[110px] flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-line-2 text-[13px] font-medium text-body hover:border-ink"
        >
          <span>Upload</span>
          <span className="text-[11px] text-muted">or drop images</span>
        </button>
        <form
          className="col-span-2 flex flex-col justify-center gap-1.5 sm:col-span-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) set({ inspiration: addOnce(p.inspiration, link.trim()) });
            setLink("");
          }}
        >
          <label htmlFor="insp-link" className="text-[13px] font-medium">
            Paste a link
          </label>
          <input
            id="insp-link"
            className="field min-h-11 text-[13px]"
            placeholder="pinterest.com/ananya/wedding"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </form>
      </div>
    </Block>
  );
}

function LookStep(props: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <MoodWords {...props} />
      <Colours {...props} />
      <Inspiration {...props} />
    </div>
  );
}

function PrioritiesStep({ p, set }: StepProps) {
  return <PriorityPicker profile={p} onToggle={(o, list) => set({ [list]: togglePick(p[list], o, list) })} />;
}

/** An Indian mobile number (ten digits from 6–9) or an email address. */
function isContact(v: string): boolean {
  return /^[6-9]\d{9}$/.test(v.replace(/\D/g, "")) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function CoPlannersStep({ p, set }: StepProps) {
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex max-w-[560px] flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = invite.trim();
          if (!isContact(v)) {
            setError("Enter a 10-digit mobile number or an email address.");
            return;
          }
          setError("");
          set({ coPlanners: addOnce(p.coPlanners, v) });
          setInvite("");
        }}
      >
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <label htmlFor="invite" className="label">
            Mobile number or email
          </label>
          <input
            id="invite"
            className="field"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="98470 55555 or rohan@example.com"
            aria-invalid={!!error}
          />
        </div>
        <button type="submit" className="btn btn-secondary btn-lg">
          Add co-planner
        </button>
      </form>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-rust-ink">
          {error}
        </p>
      )}
      {p.coPlanners.length ? (
        <ul className="m-0 flex max-w-[560px] list-none flex-col p-0">
          {p.coPlanners.map((c) => (
            <li key={c} className="flex items-center justify-between border-t border-sand-2 py-2.5 text-sm">
              <span>{c}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => set({ coPlanners: p.coPlanners.filter((x) => x !== c) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted">
          No co-planners yet. You can invite people any time from the dashboard.
        </p>
      )}
    </div>
  );
}

/** The guided form's steps, in order; the last is co-planners. */
const STEP_BODIES: ((props: StepProps) => ReactNode)[] = [
  KindStep,
  FunctionsStep,
  DateStep,
  PlaceStep,
  GuestsStep,
  BudgetStep,
  NeedsStep,
  LookStep,
  PrioritiesStep,
  CoPlannersStep,
];

/** The questions for one step of the guided form. */
export function StepBody({ step, p, set }: Pick<StepProps, "p" | "set"> & { step: number }) {
  const [previews, setPreviews] = useState<ImagePreview[]>([]);
  const Body = STEP_BODIES[step] ?? CoPlannersStep;
  return (
    <Body p={p} set={set} previews={previews} addPreviews={(added) => setPreviews((x) => [...x, ...added])} />
  );
}
