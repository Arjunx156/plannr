import { useRef, useState } from "react";
import { AddImages, InspirationTile, imagesFrom } from "../../components/intake";
import { addOnce, Block, type StepProps, toggle } from "./fields";

/** The look-and-feel step: mood words, colours and inspiration images or links. */

const MOODS = ["Temple-inspired", "Elegant", "Warm", "Grand", "Minimal", "Vibrant", "Garden", "Modern"];

const COLOURS: { name: string; hex: string }[] = [
  { name: "Kasavu gold", hex: "#D6B15E" },
  { name: "Ivory", hex: "#F4EEDF" },
  { name: "Mango leaf", hex: "#3D7A4F" },
  { name: "Kumkum", hex: "#A8322A" },
  { name: "Peacock", hex: "#1F5F6B" },
];

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
  const addImages = (files: FileList) => {
    const added = imagesFrom(files);
    addPreviews(added);
    set({ inspiration: [...p.inspiration, ...added.map((a) => a.name)] });
  };
  return (
    <Block label="Inspiration">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]">
        {p.inspiration.slice(-3).map((name) => (
          <InspirationTile
            key={name}
            name={name}
            url={previews.find((i) => i.name === name)?.url}
            className="h-[110px] rounded-[10px] p-2 text-[10px]"
          />
        ))}
        <AddImages
          onAdd={addImages}
          className="flex h-[110px] flex-col items-center justify-center gap-1 rounded-[10px] text-[13px]"
        >
          <span>Upload</span>
          <span className="text-xs text-muted">or drop images</span>
        </AddImages>
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

export function LookStep(props: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <MoodWords {...props} />
      <Colours {...props} />
      <Inspiration {...props} />
    </div>
  );
}
