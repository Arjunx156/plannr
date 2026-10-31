import { useNavigate } from "react-router";
import { usePageMeta } from "../components/pageMeta";
import { SkipLink } from "../components/ui";
import { useStore } from "../store/store";
import { LandingFooter } from "./landing/footer";
import { Hero } from "./landing/hero";
import { SamplePlans } from "./landing/samplePlans";
import { Examples, Faq, Features, HowItWorks, Occasions, Pricing } from "./landing/sections";

/** The front page: what Plannr does, for whom, and a sentence box to start with. */
export function Landing() {
  usePageMeta("Plannr");
  const navigate = useNavigate();
  const { state, dispatch } = useStore();
  const demoMode = state.mode === "demo";

  /** Opens the sample events in this browser, without an account. */
  const demo = (to = "/events") => {
    if (!demoMode || !state.session.signedIn) dispatch({ type: "enterDemo" });
    void navigate(to);
  };

  return (
    <div className="bg-paper text-ink">
      <SkipLink />
      <Hero signedIn={state.session.signedIn} demoMode={demoMode} onDemo={() => demo()} />
      <main>
        <Occasions />
        <HowItWorks />
        <Features />
        <SamplePlans demoMode={demoMode} onDemo={demo} />
        <Examples />
        <Pricing />
        <Faq />
      </main>
      <LandingFooter />
    </div>
  );
}
