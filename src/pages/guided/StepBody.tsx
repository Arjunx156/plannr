import { type ReactNode, useRef, useState } from "react";
import { PriorityPicker } from "../../components/intake";
import type { Kind, Profile } from "../../data/types";
import { addDays, longDate, TODAY } from "../../lib/dates";
import { inr } from "../../lib/format";
import { KIND_LABEL } from "../../lib/intake";
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

/** The questions for one step of the guided form. */
export function StepBody({
  step,
  p,
  set,
}: {
  step: number;
  p: Profile;
  set: (patch: Partial<Profile>) => void;
}) {
  const { dispatch } = useStore();
  const [ownMood, setOwnMood] = useState("");
  const [link, setLink] = useState("");
  const [invite, setInvite] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const colourRef = useRef<HTMLInputElement>(null);
  const kind = p.kind ?? "other";

  switch (step) {
    case 0:
      return (
        <div className="flex flex-col gap-7">
          <Block label="Event type">
            <Chips
              single
              options={Object.values(KIND_LABEL).map((l) => (l === "Event" ? "Something else" : l))}
              selected={p.kind ? [p.kind === "other" ? "Something else" : KIND_LABEL[p.kind]] : []}
              onToggle={(o) => {
                const k = (Object.entries(KIND_LABEL).find(([, l]) => l === o)?.[0] ?? "other") as Kind;
                set({
                  kind: k,
                  functions: k === "wedding" && !p.functions.length ? ["Ceremony"] : p.functions,
                });
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
    case 1:
      return (
        <Block label="Functions">
          <Chips
            options={FUNCTION_CHOICES[kind]}
            selected={p.functions}
            onToggle={(o) => set({ functions: toggle(p.functions, o) })}
          />
        </Block>
      );
    case 2:
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
          {p.dateText && (
            <span className="text-xs text-peacock">◆ Tasks will work back from {p.dateText}.</span>
          )}
        </Block>
      );
    case 3:
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
          {p.venueStatus && p.venueStatus !== "Not started" && (
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
    case 4:
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
          <div className="flex flex-wrap gap-2">
            {[30, 50, 100, 250, 500].map((n) => (
              <button
                key={n}
                type="button"
                className="chip chip-sm"
                aria-pressed={p.guests === n}
                onClick={() => set({ guests: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </Block>
      );
    case 5:
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
          <div className="flex flex-wrap gap-2">
            {[40000, 250000, 500000, 1000000, 1800000].map((n) => (
              <button
                key={n}
                type="button"
                className="chip chip-sm"
                aria-pressed={p.budget === n}
                onClick={() => set({ budget: n })}
              >
                {inr(n)}
              </button>
            ))}
          </div>
        </Block>
      );
    case 6:
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
    case 7:
      return (
        <div className="flex flex-col gap-7">
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
                  const m = ownMood.trim();
                  if (m) set({ moods: [...new Set([...p.moods, m])] });
                  setOwnMood("");
                }}
                className="inline-flex"
              >
                <label htmlFor="own-mood" className="sr-only">
                  Your own mood word
                </label>
                <input
                  id="own-mood"
                  value={ownMood}
                  onChange={(e) => setOwnMood(e.target.value)}
                  placeholder="+ Your own"
                  className="min-h-10 w-[130px] rounded-full border border-dashed border-line-2 bg-transparent px-3.5 text-sm outline-none focus:border-solid focus:border-ink"
                />
              </form>
            </div>
          </Block>
          <Block label="Colours">
            <div className="flex flex-wrap gap-3.5">
              {[
                ...COLOURS,
                ...p.colours.filter((c) => c.startsWith("#")).map((hex) => ({ name: hex, hex })),
              ].map((c) => {
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
                onClick={() => colourRef.current?.click()}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="flex h-[60px] w-[60px] items-center justify-center rounded-xl border-[1.5px] border-dashed border-line-2 font-serif text-[22px] text-body">
                  +
                </span>
                <span className="text-xs font-medium text-body">Pick</span>
              </button>
              <input
                ref={colourRef}
                type="color"
                className="sr-only"
                tabIndex={-1}
                aria-label="Pick a colour"
                onChange={(e) => set({ colours: [...new Set([...p.colours, e.target.value.toUpperCase()])] })}
              />
            </div>
          </Block>
          <Block label="Inspiration">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]">
              {p.inspiration.slice(-3).map((name) => {
                const img = images.find((i) => i.name === name);
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
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/"));
                  const added = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
                  setImages((x) => [...x, ...added]);
                  set({ inspiration: [...p.inspiration, ...added.map((a) => a.name)] });
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
                  const added = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
                  setImages((x) => [...x, ...added]);
                  set({ inspiration: [...p.inspiration, ...added.map((a) => a.name)] });
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
                  const l = link.trim();
                  if (l) set({ inspiration: [...new Set([...p.inspiration, l])] });
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
        </div>
      );
    case 8:
      return (
        <PriorityPicker
          profile={p}
          onToggle={(o, list) => {
            const prev = p[list];
            const has = prev.includes(o);
            if (!has && list === "priorities" && prev.length >= 3) return;
            set({ [list]: has ? prev.filter((x) => x !== o) : [...prev, o] });
          }}
        />
      );
    default:
      return (
        <div className="flex flex-col gap-4">
          <form
            className="flex max-w-[560px] flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = invite.trim();
              const ok = /^[6-9]\d{9}$/.test(v.replace(/\D/g, "")) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
              if (!ok) {
                setInviteError("Enter a 10-digit mobile number or an email address.");
                return;
              }
              setInviteError("");
              set({ coPlanners: [...new Set([...p.coPlanners, v])] });
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
                aria-invalid={!!inviteError}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-lg">
              Add co-planner
            </button>
          </form>
          {inviteError && (
            <p role="alert" className="m-0 text-[13px] text-rust-ink">
              {inviteError}
            </p>
          )}
          {p.coPlanners.length ? (
            <ul className="m-0 flex max-w-[560px] list-none flex-col p-0">
              {p.coPlanners.map((c) => (
                <li
                  key={c}
                  className="flex items-center justify-between border-t border-sand-2 py-2.5 text-sm"
                >
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
}
