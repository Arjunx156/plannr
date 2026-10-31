import { type ReactNode, useState } from "react";
import type { ImagePreview } from "../../components/intake";
import { PriorityPicker } from "../../components/intake";
import type { Kind } from "../../data/baseTypes";
import type { Profile } from "../../data/types";
import { addDays, longDate, TODAY } from "../../lib/dates";
import { inr } from "../../lib/format";
import { togglePick } from "../../lib/intakeQuestions";
import { KIND_LABEL } from "../../lib/profileRows";
import { TEMPLATES, type TemplateId, templateProfile } from "../../lib/templates";
import { useStore } from "../../store/store";
import { CoPlannersStep } from "./CoPlannersStep";
import { Block, Chips, QuickPicks, type StepProps, toggle } from "./fields";
import { LookStep } from "./LookStep";

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
            set({
              kind,
              functions: kind === "wedding" && p.functions.length === 0 ? ["Ceremony"] : p.functions,
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

function PrioritiesStep({ p, set }: StepProps) {
  return <PriorityPicker profile={p} onToggle={(o, list) => set({ [list]: togglePick(p[list], o, list) })} />;
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
