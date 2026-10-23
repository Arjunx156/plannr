import { type ReactNode, useState } from "react";
import { PreviewCard } from "../components/assistant";
import {
  Avatar,
  Bar,
  Field,
  HUE_COLOR,
  Logo,
  Menu,
  MenuDivider,
  MenuItem,
  Modal,
  Panel,
  Pill,
  Spinner,
  StatTile,
  Toran,
  usePageMeta,
} from "../components/ui";
import type { Hue, Preview } from "../data/types";
import { toast, useStore } from "../store/store";

/**
 * Every shared building block on one page, on paper and in the lamp-lit night theme,
 * at full width or phone width. New components land here before they land in a screen.
 */

const COLORS: [string, string][] = [
  ["paper", "Page ground"],
  ["surface", "Cards, fields, menus"],
  ["sand", "Quiet fills"],
  ["line", "Hairlines"],
  ["ink", "Text, primary actions"],
  ["body", "Running text"],
  ["muted", "Secondary text"],
  ["peacock", "Plannr's voice, approvals"],
  ["peacock-tint", "AI surfaces"],
  ["rust-ink", "Risk, overdue"],
  ["amber-ink", "Due soon"],
  ["leaf-ink", "Done, on track"],
];

const SAMPLE: Preview = {
  id: "sample",
  title: "Preview · 3 changes",
  tag: "Haldi",
  change: "move-haldi",
  status: "pending",
  rows: [
    { title: "Haldi date", from: "Sat 24 Apr", to: "Fri 23 Apr, 5:00 pm" },
    { title: "2 tasks move a day earlier", detail: "Haldi caterer headcount · Collect turmeric & marigolds" },
    {
      title: "Heads-up",
      detail: "Mehendi is Thursday night, so the bride has back-to-back evenings.",
      headsUp: true,
    },
  ],
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs font-medium tracking-[0.08em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Specimens() {
  const { dispatch } = useStore();
  const [modal, setModal] = useState(false);
  const [chip, setChip] = useState("Food");
  return (
    <div className="flex flex-col gap-9">
      <Section title="Colour">
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5 p-0">
          {COLORS.map(([name, role]) => (
            <li key={name} className="flex flex-col gap-1 text-xs">
              <span
                className="h-12 rounded-lg border border-line"
                style={{ background: `var(--color-${name})` }}
              />
              <span className="font-semibold text-ink">{name}</span>
              <span className="text-muted">{role}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(HUE_COLOR) as Hue[]).map((h) => (
            <span key={h} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ background: HUE_COLOR[h] }} />
              {h}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-2">
          <span className="font-serif text-[48px] leading-none">Ananya &amp; Rohan</span>
          <span className="font-serif text-[28px] leading-tight">Everything connected</span>
          <span className="text-lg font-semibold">Pay the venue balance, ₹1,20,000</span>
          <span className="text-base text-body">Running text sits at 16px with room to breathe.</span>
          <span className="font-mono text-xs font-medium tracking-[0.06em] uppercase">
            Sun 25 Apr · 10:42 am
          </span>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary">
            Primary
          </button>
          <button type="button" className="btn btn-secondary">
            Secondary
          </button>
          <button type="button" className="btn btn-outline">
            Outline
          </button>
          <button type="button" className="btn btn-ai">
            Apply changes
          </button>
          <button type="button" className="btn btn-gold">
            Start planning
          </button>
          <button type="button" className="btn btn-ghost">
            Ghost
          </button>
          <button type="button" className="btn btn-danger">
            Delete
          </button>
          <button type="button" className="btn btn-primary" disabled>
            Disabled
          </button>
          <button type="button" className="btn btn-primary btn-sm">
            Small
          </button>
          <button type="button" className="btn btn-primary btn-lg">
            Large
          </button>
        </div>
      </Section>

      <Section title="Chips and status">
        <div className="flex flex-wrap gap-2">
          {["Food", "Photography", "Ceremony décor"].map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={chip === c}
              onClick={() => setChip(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="warn">Booking window closing</Pill>
          <Pill tone="due">Due Mon 5 Oct</Pill>
          <Pill tone="ok">Booked</Pill>
          <Pill tone="idle">Not started</Pill>
          <Pill tone="ai">Waiting for your approval</Pill>
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Studio" htmlFor="g-studio">
            <input id="g-studio" className="field" placeholder="Lens & Light" />
          </Field>
          <Field
            label="Package price (₹)"
            htmlFor="g-price"
            hint={<span className="text-xs text-muted">Whole rupees</span>}
          >
            <input id="g-price" className="field" inputMode="numeric" defaultValue="2,40,000" />
          </Field>
        </div>
      </Section>

      <Section title="Numbers">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Readiness"
            value="41%"
            sub="2 overdue tasks"
            bar={0.41}
            color="var(--color-peacock)"
          />
          <StatTile label="Budget" value="₹6.85L" sub="spent of ₹18L" bar={0.38} color="var(--color-leaf)" />
          <StatTile label="Tasks" value="22/71" sub="10 open on the list" bar={0.31} />
          <StatTile
            label="Guests"
            value="96"
            sub="confirmed of 268"
            bar={0.36}
            color="var(--color-marigold)"
          />
        </div>
        <Bar value={0.62} color="var(--color-peacock)" label="Example progress" />
      </Section>

      <Section title="Panels, previews and people">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Vendors" aside={<span className="link text-xs">Show all</span>}>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="ok">Venue</Pill>
              <Pill tone="due">Catering</Pill>
              <Pill tone="idle">Mehendi artist</Pill>
            </div>
            <div className="flex -space-x-2">
              {[
                { initials: "PM", bg: "#1F5F6B", fg: "#fff", name: "Priya Menon" },
                { initials: "RN", bg: "#D9962B", fg: "#1f1b16", name: "Rohan Nair" },
                { initials: "AM", bg: "#6E1F2E", fg: "#fff", name: "Ananya Menon" },
              ].map((p) => (
                <Avatar key={p.initials} p={p} />
              ))}
            </div>
          </Panel>
          <PreviewCard preview={SAMPLE} onDecide={() => dispatch(toast("This is a gallery sample."))} />
        </div>
      </Section>

      <Section title="Overlays and feedback">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-secondary" onClick={() => setModal(true)}>
            Open a modal
          </button>
          <Menu
            label="Example menu"
            align="left"
            button={({ open, toggle, id }) => (
              <button
                type="button"
                className="btn btn-secondary"
                aria-expanded={open}
                aria-controls={id}
                onClick={toggle}
              >
                Open a menu
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem onSelect={close}>Rename</MenuItem>
                <MenuItem onSelect={close} hint="Archive keeps everything">
                  Archive
                </MenuItem>
                <MenuDivider />
                <MenuItem danger onSelect={close}>
                  Delete
                </MenuItem>
              </>
            )}
          </Menu>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dispatch(toast("Done: Book the photographer", { type: "readNotifications" }))}
          >
            Show a toast
          </button>
          <Spinner label="Loading" />
          <span className="shimmer h-3 w-40 rounded" />
        </div>
        <Modal open={modal} onClose={() => setModal(false)} title="Book the photographer">
          <p className="m-0 text-sm text-body">
            Modals use the native dialog: focus trap and Escape come with it.
          </p>
          <button type="button" className="btn btn-primary self-start" onClick={() => setModal(false)}>
            Done
          </button>
        </Modal>
      </Section>
    </div>
  );
}

export function Gallery() {
  usePageMeta("Component gallery", { private: true });
  const [phone, setPhone] = useState(false);
  return (
    <div className="min-h-dvh bg-paper">
      <Toran />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-8">
        <span className="flex items-center gap-3">
          <Logo to="/" />
          <span className="font-mono text-xs text-muted uppercase">Component gallery</span>
        </span>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={phone} onChange={(e) => setPhone(e.target.checked)} />
          Phone width
        </label>
      </header>
      <main className="grid gap-px bg-line xl:grid-cols-2">
        {(["day", "night"] as const).map((theme) => (
          <div
            key={theme}
            data-theme={theme === "night" ? "night" : undefined}
            data-testid={`gallery-${theme}`}
            className="flex flex-col gap-6 bg-paper px-4 py-8 sm:px-8"
          >
            <h1 className="font-serif text-[32px] leading-none">
              {theme === "day" ? "Paper" : "Lamp-lit night"}
            </h1>
            <div className={phone ? "mx-auto w-[390px] max-w-full" : ""}>
              <Specimens />
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
