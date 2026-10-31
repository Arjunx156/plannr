import { Link } from "react-router";
import { Logo, Toran } from "../../components/brand";
import { PAD } from "./layout";

/** The closing call to start, links to the public pages, and who made it. */
export function LandingFooter() {
  return (
    <footer className="on-dark relative flex flex-col gap-12 overflow-hidden bg-ink pt-16 pb-10 text-stone">
      <Toran size="lg" className="absolute inset-x-0 top-0" />
      <div className={`flex flex-col justify-between gap-8 sm:flex-row sm:items-end ${PAD}`}>
        <p className="m-0 max-w-[640px] font-serif text-[clamp(40px,5vw,56px)] leading-[1.05] text-white">
          What are you celebrating?
        </p>
        <Link to="/new" className="btn btn-gold btn-lg self-start sm:self-auto">
          Start planning
        </Link>
      </div>
      <div className={`flex flex-col gap-8`}>
        <div
          className={`mx-5 grid gap-8 border-t border-[#3A332B] pt-8 text-sm leading-[1.9] sm:mx-10 sm:grid-cols-2 lg:mx-[72px] lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]`}
        >
          <div className="flex flex-col gap-2">
            <Logo size={28} tone="light" />
            <span className="text-line-2">
              Made in Kochi. Guest pages in English, Malayalam, Hindi and Tamil.
            </span>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["/how-it-works", "How it works"],
              ["#occasions", "Templates"],
              ["#pricing", "Pricing"],
            ]}
          />
          <FooterCol
            title="Plan a"
            links={[
              ["/weddings", "Wedding"],
              ["/birthdays", "Birthday"],
              ["/community", "Community event"],
              ["/tools", "Free tools"],
            ]}
          />
          <FooterCol
            title="Plannr"
            links={[
              ["/privacy", "Privacy"],
              ["/terms", "Terms"],
              ["/signin", "Sign in or try the demo"],
            ]}
          />
        </div>
        <p className={`m-0 text-[13px] text-line-2 ${PAD}`}>© 2026 Plannr · Engineered by Arjun Krishnan</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-white">{title}</span>
      {links.map(([href, label]) =>
        href.startsWith("#") ? (
          <a
            key={href}
            href={href}
            className="text-stone no-underline hover:text-white hover:underline underline-offset-4"
          >
            {label}
          </a>
        ) : (
          <Link
            key={href}
            to={href}
            className="text-stone no-underline hover:text-white hover:underline underline-offset-4"
          >
            {label}
          </Link>
        ),
      )}
    </div>
  );
}
