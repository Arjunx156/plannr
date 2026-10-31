import { useState } from "react";
import { Logo, Toran } from "../components/brand";
import { usePageMeta } from "../components/pageMeta";
import { Specimens } from "./gallery/specimens";

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
      <main id="main" className="grid gap-px bg-line xl:grid-cols-2">
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
