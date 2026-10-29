import { type FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Logo, Toran, usePageMeta } from "../components/ui";
import { api } from "../lib/api";
import { initials } from "../lib/format";
import { toast, useStore } from "../store/store";
import { useAcceptPlan } from "../store/useAcceptPlan";

const LANGUAGES: { label: string; lang?: string; name: string }[] = [
  { label: "English", name: "English" },
  { label: "മലയാളം", lang: "ml", name: "Malayalam" },
  { label: "हिन्दी", lang: "hi", name: "Hindi" },
  { label: "தமிழ்", lang: "ta", name: "Tamil" },
  { label: "ಕನ್ನಡ", lang: "kn", name: "Kannada" },
  { label: "తెలుగు", lang: "te", name: "Telugu" },
];
const MORE: { label: string; lang: string; name: string }[] = [
  { label: "मराठी", lang: "mr", name: "Marathi" },
  { label: "বাংলা", lang: "bn", name: "Bengali" },
  { label: "ગુજરાતી", lang: "gu", name: "Gujarati" },
];

const DISTRICTS: Record<string, string> = {
  kochi: "Ernakulam district",
  kakkanad: "Ernakulam district",
  thrissur: "Thrissur district",
  kozhikode: "Kozhikode district",
  thiruvananthapuram: "Thiruvananthapuram district",
  bengaluru: "Bengaluru Urban",
  chennai: "Chennai district",
};

export function Onboarding() {
  usePageMeta("Almost there", { private: true });
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accept = useAcceptPlan();
  // A guest starts as "Guest planner"; co-planners should see a real name instead.
  const guestName = state.account.user?.isAnonymous && state.session.name === "Guest planner";
  const [name, setName] = useState(guestName ? "" : state.session.name);
  const [city, setCity] = useState(state.session.city);
  const [language, setLanguage] = useState(state.session.language);
  const [currency, setCurrency] = useState("INR");
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const cityKey = city.split(",")[0]?.trim().toLowerCase() ?? "";
  const district = DISTRICTS[cityKey];
  const cityName = city.split(",")[0]?.trim();

  const next = params.get("next");
  const go = () => {
    if (next === "accept" && state.draft.generated) void accept();
    else navigate(next?.startsWith("/") ? next : "/events");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Add your name so co-planners know who made a change.");
      return;
    }
    const clean = name.trim();
    dispatch({
      type: "updateSession",
      patch: {
        name: clean,
        firstName: clean.split(/\s+/)[0] ?? clean,
        initials: initials(clean),
        city: city.trim(),
        language,
      },
    });
    if (state.mode === "account")
      api.rename(clean).catch(() => dispatch(toast("Couldn't save your name yet. It will show as before.")));
    go();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-sand">
      <Toran />
      <div className="flex items-center px-5 py-4 sm:px-10">
        <Logo to="/" />
      </div>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center">
        <form
          onSubmit={submit}
          noValidate
          className="flex w-full max-w-[640px] flex-col gap-[22px] rounded-xl bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,.06),0_16px_48px_rgba(60,40,20,.10)] sm:px-14 sm:py-12"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow text-muted">Almost there · 1 of 1</span>
            <button type="button" className="btn btn-ghost btn-sm -mr-2 text-[13px]" onClick={go}>
              Skip for now
            </button>
          </div>
          <h1 className="font-serif text-[34px] leading-[1.1]">So plans fit where you live</h1>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="label">
              Your name
            </label>
            <input
              id="name"
              className="field"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "name-error" : undefined}
            />
            {error && (
              <span id="name-error" role="alert" className="text-[13px] font-medium text-rust-ink">
                {error}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="city" className="label">
              City
            </label>
            <div className="field gap-3">
              <input
                id="city"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
              {district && <span className="hidden text-[13px] text-muted sm:inline">{district}</span>}
            </div>
            {cityName && (
              <span className="text-xs leading-[1.4] text-peacock">
                ◆ Vendor suggestions, prices and booking windows will use {cityName}.
              </span>
            )}
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="label mb-2">Preferred language</legend>
            <div className="flex flex-wrap gap-2">
              {[...LANGUAGES, ...(more ? MORE : [])].map((l) => (
                <button
                  key={l.name}
                  type="button"
                  lang={l.lang}
                  aria-pressed={language === l.name}
                  aria-label={l.lang ? `${l.name} (${l.label})` : l.name}
                  onClick={() => setLanguage(l.name)}
                  className="chip min-h-10 rounded-[10px] px-3.5 text-[15px]"
                >
                  {l.label}
                </button>
              ))}
              {!more && (
                <button
                  type="button"
                  onClick={() => setMore(true)}
                  className="chip min-h-10 rounded-[10px] border-dashed border-line-2 px-3.5 text-[15px] text-body"
                >
                  More
                </button>
              )}
            </div>
            <span className="text-xs leading-[1.4] text-muted">
              The assistant replies in any of these, whatever this is set to.
            </span>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="currency" className="label">
              Currency
            </label>
            <select
              id="currency"
              className="field appearance-auto"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="INR">₹ Indian Rupee · lakh format (18,00,000)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-lg mt-2 min-h-[50px]">
            {next === "accept" && state.draft.generated
              ? "Continue to my plan"
              : next?.startsWith("/join/")
                ? "Continue to the invite"
                : "Continue to my events"}
          </button>
        </form>
      </main>
    </div>
  );
}
