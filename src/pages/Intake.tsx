import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { canDraft, PriorityPicker } from "../components/intake";
import { Logo, Toran, usePageMeta } from "../components/ui";
import { HoldToSpeak, LangSelect } from "../components/voice";
import type { Kind, Profile } from "../data/types";
import {
  detectDate,
  detectKind,
  emptyProfile,
  KIND_LABEL,
  nextQuestion,
  parseDescription,
  profileRows,
  type Question,
  type QuestionField,
} from "../lib/intake";
import type { SpeechCode } from "../lib/voice";
import { type ChatTurn, type Draft, useStore } from "../store/store";
import { Guided } from "./Guided";

let turnSeq = 0;
const turnId = () => {
  turnSeq += 1;
  return `c${Date.now().toString(36)}${turnSeq}`;
};

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six"];
const DONE =
  "That's everything I need. Press Draft my plan when you're ready, or tell me who's planning with you.";

const KIND_FROM_CHIP: Record<string, Kind> = {
  Wedding: "wedding",
  Birthday: "birthday",
  "Community event": "community",
  "Something else": "other",
};

function joinList(parts: string[]): string {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function opener(p: Profile): string {
  if (!p.kind && !p.city && !p.guests && !p.budget) return "Thanks. Let's take it one step at a time.";
  if (p.kind === "wedding" && p.names)
    return `Congratulations to ${p.names.replace(" & ", " and ")}. I've filled in most of the profile from that. A few quick questions and I'll draft the plan.`;
  if (p.kind === "birthday")
    return `${p.style ? `A ${p.style.replace(" theme", "").toLowerCase()} party sounds brilliant. ` : ""}I've filled in what I could. A couple of quick questions and I'll draft the plan.`;
  if (p.kind === "community")
    return "A mela has a lot of moving parts. I've filled in what I could from that; a few quick questions and I'll draft the plan.";
  return "Got it. I've filled in what I could from that.";
}

function acknowledge(prev: Profile, next: Profile): string {
  const parts: string[] = [];
  if (next.functions.length > prev.functions.length && next.functions.length > 1)
    parts.push(`${NUMBER_WORDS[next.functions.length] ?? next.functions.length} functions`);
  const fresh = next.needs.filter((n) => !prev.needs.includes(n));
  if (fresh.some((n) => /wheelchair/i.test(n)))
    parts.push(
      next.venues?.includes(" or ")
        ? "I'll flag step-free access when comparing the two venues"
        : "I'll flag step-free access with the venue",
    );
  if (fresh.includes("Vegetarian")) parts.push("a vegetarian menu");
  if (fresh.some((n) => /allerg/i.test(n))) parts.push("allergy notes on the RSVP form");
  if (next.venues && next.venues !== prev.venues && !parts.length) parts.push(`venue: ${next.venues}`);
  return parts.length ? `Noted: ${joinList(parts)}.` : "Noted.";
}

/** The next question, phrased for what was just answered. */
function questionAfter(p: Profile, asked: QuestionField[], answered?: QuestionField): Question | null {
  const q = nextQuestion(p, new Set(asked));
  if (q?.field === "extras" && answered === "venue") {
    const tail =
      p.kind === "wedding"
        ? "Add any other functions, traditions or accessibility needs too."
        : "Add anything else I should plan around.";
    if (p.venueStatus === "Shortlisted")
      return { ...q, prompt: `Which ones are you choosing between? ${tail}` };
    if (p.venueStatus === "Booked") return { ...q, prompt: `Which venue is it? ${tail}` };
    return { ...q, prompt: `No problem, I'll put venue visits in the first week. ${tail}` };
  }
  return q;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Field-specific fallbacks for short answers like "Thrissur" or "18". */
function readAnswer(text: string, p: Profile, field: QuestionField | undefined): Profile {
  const next = parseDescription(text, p);
  if (field === "kind" && !next.kind) next.kind = detectKind(text) ?? "other";
  if (field === "city" && !next.city) {
    const city = text.trim().split(/[,.]/)[0]?.trim();
    if (city && city.length <= 40) next.city = titleCase(city);
  }
  if (field === "guests" && !next.guests) {
    const n = Number(text.match(/\d[\d,]*/)?.[0]?.replace(/,/g, ""));
    if (n > 0) next.guests = n;
  }
  if (field === "budget" && !next.budget) {
    const n = Number(text.match(/\d[\d,.]*/)?.[0]?.replace(/,/g, ""));
    // A bare "18" to the budget question means lakhs; anything bigger is rupees.
    if (n > 0) next.budget = n < 1000 ? n * 100000 : n;
  }
  if (field === "date" && !next.date) {
    const d = detectDate(`in ${text}`);
    if (d) {
      next.date = d.date;
      next.dateText = d.label;
    }
  }
  const link = text.match(/https?:\/\/\S+|\b[\w-]+\.(?:com|in|co)\/\S*/i)?.[0];
  if (link && !next.inspiration.includes(link)) next.inspiration = [...next.inspiration, link];
  return next;
}

export function Intake() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "guided" ? "guided" : "chat";
  usePageMeta(mode === "guided" ? "Guided plan" : "Describe your event");
  const { state, dispatch } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const draft = state.draft;
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const type = params.get("type") as Kind | null;
    const eventId = params.get("event");
    const prompt = (location.state as { prompt?: string } | null)?.prompt;
    if (eventId) {
      const ev = state.events.find((e) => e.id === eventId);
      dispatch({ type: "draftReset", forEvent: eventId });
      if (ev)
        dispatch({ type: "draft", patch: { profile: { ...emptyProfile(), kind: ev.kind, names: ev.name } } });
    } else if (type && KIND_LABEL[type]) {
      dispatch({ type: "draftReset" });
      dispatch({
        type: "draft",
        patch: {
          profile: { ...emptyProfile(), kind: type, functions: type === "wedding" ? ["Ceremony"] : [] },
        },
      });
    } else if (prompt || params.get("fresh")) {
      dispatch({ type: "draftReset" });
    }
    if (prompt)
      navigate(`${location.pathname}${location.search}`, { replace: true, state: { autoSend: prompt } });
  }, [dispatch, location, navigate, params, state.events]);

  const setMode = (m: "chat" | "guided") => {
    const next = new URLSearchParams(params);
    next.delete("type");
    next.delete("event");
    next.delete("fresh");
    if (m === "guided") next.set("mode", "guided");
    else next.delete("mode");
    setParams(next, { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Toran />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-10">
        <Logo to="/" />
        <div
          role="tablist"
          aria-label="Intake style"
          className="order-3 grid w-full grid-cols-2 rounded-[10px] bg-sand-2 p-1 text-[13px] font-semibold sm:order-none sm:w-[320px]"
        >
          {(["chat", "guided"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-9 rounded-[7px] ${mode === m ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-body hover:text-ink"}`}
            >
              {m === "chat" ? "Describe it" : "Guided form"}
            </button>
          ))}
        </div>
        <span className="text-[13px] font-medium text-body">
          {state.session.signedIn ? (
            <>
              Signed in as {state.session.firstName} ·{" "}
              <Link to="/events" className="link">
                My events
              </Link>
            </>
          ) : (
            <>
              Planning as guest ·{" "}
              <Link to="/signin?next=/new" className="link">
                Sign in
              </Link>
            </>
          )}
        </span>
      </header>
      {mode === "chat" ? <Chat draft={draft} onEdit={() => setMode("guided")} /> : <Guided />}
    </div>
  );
}

function Chat({ draft, onEdit }: { draft: Draft; onEdit: () => void }) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [lang, setLang] = useState<SpeechCode>("EN");
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const sentAuto = useRef(false);

  const p = draft.profile;
  const last = draft.chat[draft.chat.length - 1];
  const pending = last?.role === "ai" ? last.question : undefined;
  const ready = canDraft(p);

  useEffect(() => {
    if (draft.chat.length === 0) {
      const greeting = p.kind
        ? p.kind === "other" && p.names
          ? `Let's plan ${p.names}. Where is it, roughly when, how many guests and what budget?`
          : `Tell me about the ${KIND_LABEL[p.kind].toLowerCase()}: where, roughly when, how many guests and the budget. I'll ask only for what's missing.`
        : "Describe the event in a sentence or two: what, where, roughly when, how many people and the budget. I'll ask only for what's missing.";
      dispatch({ type: "draft", patch: { chat: [{ id: turnId(), role: "ai", text: greeting }] } });
    }
  }, [draft.chat.length, p.kind, p.names, dispatch]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the conversation grows
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [draft.chat.length, thinking]);

  const respond = (aiTurn: ChatTurn, patch: Partial<Draft>) => {
    setThinking(true);
    window.setTimeout(() => {
      const current = draftRef.current;
      dispatch({ type: "draft", patch: { ...patch, chat: [...current.chat, aiTurn] } });
      setThinking(false);
    }, 650);
  };

  const send = (raw: string) => {
    const message = raw.trim();
    if (!message || thinking) return;
    const current = draftRef.current;
    const field = pendingField(current);
    const isFirst = !current.chat.some((t) => t.role === "user");
    const next = readAnswer(message, current.profile, field);
    const asked =
      field && ["venue", "extras", "priorities"].includes(field)
        ? [...new Set([...current.asked, field])]
        : current.asked;
    const userTurn: ChatTurn = { id: turnId(), role: "user", text: message };
    dispatch({ type: "draft", patch: { profile: next, asked, chat: [...current.chat, userTurn] } });
    setText("");
    const q = questionAfter(next, asked, field);
    let lead = isFirst ? opener(next) : field === "extras" ? acknowledge(current.profile, next) : "";
    if (field === "date" && !next.date)
      lead = "I couldn't place that date. A month is enough, like “December” or “in 3 weeks”.";
    if (!q) lead = lead ? `${lead} ${DONE}` : DONE;
    else if (q.field === "priorities" && lead) lead = `${lead} Last one:`;
    respond({ id: turnId(), role: "ai", text: lead, question: q ?? undefined }, {});
  };

  useEffect(() => {
    const auto = (location.state as { autoSend?: string } | null)?.autoSend;
    if (auto && !sentAuto.current && draft.chat.length === 1 && draft.chat[0]?.role === "ai") {
      sentAuto.current = true;
      send(auto);
    }
  });

  const pick = (q: Question, option: string) => {
    const current = draftRef.current;
    if (q.field === "venue") {
      const profile = { ...current.profile, venueStatus: option as Profile["venueStatus"] };
      const asked = [...new Set([...current.asked, "venue" as const])];
      dispatch({ type: "draft", patch: { profile, asked } });
      const nq = questionAfter(profile, asked, "venue");
      respond({ id: turnId(), role: "ai", text: nq ? "" : DONE, question: nq ?? undefined }, {});
    }
    if (q.field === "kind") {
      const profile = { ...current.profile, kind: KIND_FROM_CHIP[option] ?? "other" };
      dispatch({ type: "draft", patch: { profile } });
      const nq = questionAfter(profile, current.asked);
      respond({ id: turnId(), role: "ai", text: "", question: nq ?? undefined }, {});
    }
  };

  const togglePriority = (option: string, list: "priorities" | "cuts") => {
    const current = draftRef.current;
    const prev = current.profile[list];
    const has = prev.includes(option);
    const nextList = has
      ? prev.filter((x) => x !== option)
      : list === "priorities" && prev.length >= 3
        ? prev
        : [...prev, option];
    dispatch({
      type: "draft",
      patch: {
        profile: { ...current.profile, [list]: nextList },
        asked: [...new Set([...current.asked, "priorities" as const])],
      },
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(text);
    }
  };

  const addImages = (files: FileList | null) => {
    if (!files?.length) return;
    const added = [...files]
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setImages((imgs) => [...imgs, ...added]);
    const current = draftRef.current;
    dispatch({
      type: "draft",
      patch: {
        profile: {
          ...current.profile,
          inspiration: [...current.profile.inspiration, ...added.map((a) => a.name)],
        },
      },
    });
  };

  const draftPlan = () => {
    dispatch({ type: "draft", patch: { generated: false } });
    navigate("/new/generating");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col gap-5 px-4 pt-7 pb-6 sm:px-10 xl:pr-20 xl:pl-[120px]">
        <div className="flex flex-col gap-5" aria-live="polite">
          {draft.chat.map((t, i) =>
            t.role === "user" ? (
              <div
                key={t.id}
                className="rise max-w-[86%] self-end rounded-[18px_18px_4px_18px] bg-ink px-[18px] py-3.5 text-base leading-normal whitespace-pre-wrap text-paper sm:max-w-[76%]"
              >
                {t.text}
              </div>
            ) : (
              <div key={t.id} className="rise flex max-w-full gap-3 sm:max-w-[88%]">
                <AiMark />
                <div className="flex min-w-0 flex-col gap-3 text-base leading-[1.55]">
                  {t.text && <span>{t.text}</span>}
                  {t.question && <span className="font-semibold">{t.question.prompt}</span>}
                  {t.question?.options && (
                    <div className="flex flex-wrap gap-2">
                      {t.question.options.map((o) => {
                        const on =
                          (t.question?.field === "venue" && p.venueStatus === o) ||
                          (t.question?.field === "kind" && p.kind === KIND_FROM_CHIP[o]);
                        const live = i === draft.chat.length - 1;
                        return (
                          <button
                            key={o}
                            type="button"
                            disabled={!live && !on}
                            aria-pressed={on}
                            onClick={() => t.question && pick(t.question, o)}
                            className={`inline-flex min-h-9 items-center rounded-full border px-[13px] text-sm font-medium ${on ? "border-peacock bg-peacock-tint text-peacock" : "border-line text-muted hover:border-line-2 hover:text-ink disabled:hover:border-line disabled:hover:text-muted"}`}
                          >
                            {on ? `✓ ${o}` : o}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {t.question?.field === "priorities" && (
                    <PriorityPicker profile={p} onToggle={togglePriority} />
                  )}
                </div>
              </div>
            ),
          )}
          {thinking && (
            <div className="flex items-center gap-3" role="status" aria-label="Plannr is thinking">
              <AiMark />
              <span className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-peacock"
                    style={{ animation: `wave 0.9s ease-in-out ${d * 0.15}s infinite` }}
                  />
                ))}
              </span>
            </div>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="sticky bottom-3 mt-auto flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-ink bg-white py-3 pr-3 pl-[18px] shadow-[0_8px_24px_rgba(40,25,10,.08)]"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message Plannr
          </label>
          <textarea
            id="chat-input"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              ready
                ? "Add anything else, or press Draft my plan"
                : draft.chat.some((t) => t.role === "user")
                  ? "Type your answer"
                  : "Kerala wedding in Kochi, 250 guests, ₹18 lakh, December"
            }
            className="resize-none bg-transparent text-base leading-[1.4] outline-none placeholder:text-muted"
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addImages(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-sm border-line bg-transparent font-medium"
              onClick={() => fileRef.current?.click()}
            >
              + Inspiration image
            </button>
            <HoldToSpeak code={lang} onText={setText} />
            <LangSelect value={lang} onChange={setLang} />
            <div className="ml-auto flex gap-2">
              {text.trim() && (
                <button type="submit" className="btn btn-secondary btn-sm" disabled={thinking}>
                  Send
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={!ready || thinking}
                onClick={draftPlan}
              >
                Draft my plan
              </button>
            </div>
          </div>
        </form>
        <div ref={endRef} />
      </div>
      <ProfilePanel profile={p} asking={pending?.field} images={images} onAdd={addImages} onEdit={onEdit} />
    </div>
  );
}

function pendingField(d: Draft): QuestionField | undefined {
  const last = d.chat[d.chat.length - 1];
  return last?.role === "ai" ? last.question?.field : undefined;
}

function AiMark() {
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

function ProfilePanel({
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
      className="flex flex-col gap-3.5 border-t border-line bg-white p-5 sm:p-7 lg:border-t-0 lg:border-l"
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
