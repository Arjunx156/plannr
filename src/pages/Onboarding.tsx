import { type FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CardPage, PAPER_CARD } from "../components/brand";
import { usePageMeta } from "../components/pageMeta";
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

/** The button names where it leads: the waiting draft, an invite being joined, or their events. */
function continueLabel(next: string | null, draftReady: boolean): string {
  if (next === "accept" && draftReady) return "Continue to my plan";
  return next?.startsWith("/join/") ? "Continue to the invite" : "Continue to my events";
}

/** Where "Continue" leads: the waiting draft, the page that sent them here, or their events. */
function useContinue() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accept = useAcceptPlan();
  const next = params.get("next");
  const go = () => {
    if (next === "accept" && state.draft.generated) void accept();
    else void navigate(next?.startsWith("/") ? next : "/events");
  };
  return { go, label: continueLabel(next, state.draft.generated) };
}

/** Saves the profile to this session and, for an account, the name to the server as well. */
function useSaveProfile() {
  const { state, dispatch } = useStore();
  return (name: string, city: string, language: string) => {
    const firstName = name.split(/\s+/)[0] ?? name;
    dispatch({ type: "updateSession", patch: { name, firstName, initials: initials(name), city, language } });
    if (state.mode === "account")
      api.rename(name).catch(() => dispatch(toast("Couldn't save your name yet. It will show as before.")));
  };
}

/** /onboarding — a name, a city and a language, so plans fit where the planner lives. */
export function Onboarding() {
  usePageMeta("Almost there", { private: true });
  const { state } = useStore();
  const next = useContinue();
  const saveProfile = useSaveProfile();
  // A guest starts as "Guest planner"; co-planners should see a real name instead.
  const guestName = state.account.user?.isAnonymous && state.session.name === "Guest planner";
  const [name, setName] = useState(guestName ? "" : state.session.name);
  const [city, setCity] = useState(state.session.city);
  const [language, setLanguage] = useState(state.session.language);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError("Add your name so co-planners know who made a change.");
      return;
    }
    saveProfile(clean, city.trim(), language);
    next.go();
  };

  return (
    <CardPage>
      <form
        onSubmit={submit}
        noValidate
        className={`max-w-[640px] gap-[22px] ${PAPER_CARD} sm:px-14 sm:py-12`}
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow text-muted">Almost there · 1 of 1</span>
          <button type="button" className="btn btn-ghost btn-sm -mr-2 text-[13px]" onClick={next.go}>
            Skip for now
          </button>
        </div>
        <h1 className="font-serif text-[34px] leading-[1.1]">So plans fit where you live</h1>
        <NameField value={name} onChange={setName} error={error} />
        <CityField value={city} onChange={setCity} />
        <LanguagePicker value={language} onChange={setLanguage} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="currency" className="label">
            Currency
          </label>
          <select id="currency" className="field appearance-auto" defaultValue="INR">
            <option value="INR">₹ Indian Rupee · lakh format (18,00,000)</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-lg mt-2 min-h-[50px]">
          {next.label}
        </button>
      </form>
    </CardPage>
  );
}

interface FieldProps {
  value: string;
  onChange: (value: string) => void;
}

function NameField({ value, onChange, error }: FieldProps & { error: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="name" className="label">
        Your name
      </label>
      <input
        id="name"
        className="field"
        autoComplete="name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? "name-error" : undefined}
      />
      {error && (
        <span id="name-error" role="alert" className="text-[13px] font-medium text-rust-ink">
          {error}
        </span>
      )}
    </div>
  );
}

/** The city, with its district shown when known, since vendors and prices follow it. */
function CityField({ value, onChange }: FieldProps) {
  const cityName = value.split(",")[0]?.trim() ?? "";
  const district = DISTRICTS[cityName.toLowerCase()];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="city" className="label">
        City
      </label>
      <div className="field gap-3">
        <input
          id="city"
          autoComplete="address-level2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
  );
}

/** The six most asked-for languages, with three more behind "More". */
function LanguagePicker({ value, onChange }: FieldProps) {
  const [more, setMore] = useState(false);
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="label mb-2">Preferred language</legend>
      <div className="flex flex-wrap gap-2">
        {[...LANGUAGES, ...(more ? MORE : [])].map((l) => (
          <button
            key={l.name}
            type="button"
            lang={l.lang}
            aria-pressed={value === l.name}
            aria-label={l.lang ? `${l.name} (${l.label})` : l.name}
            onClick={() => onChange(l.name)}
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
  );
}
