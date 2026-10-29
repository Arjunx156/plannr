import { lazy, type ReactNode, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Logo, Spinner, Toasts } from "./components/ui";
import { Landing } from "./pages/Landing";
import { AccountSync } from "./store/account";
import { useStore } from "./store/store";

// The landing page ships in the first bundle; every other screen loads when it is opened.
const Intake = lazy(() => import("./pages/Intake").then((m) => ({ default: m.Intake })));
const Plan = lazy(() => import("./pages/Plan").then((m) => ({ default: m.Plan })));
const Auth = lazy(() => import("./pages/Auth").then((m) => ({ default: m.Auth })));
const Onboarding = lazy(() => import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })));
const Events = lazy(() => import("./pages/Events").then((m) => ({ default: m.Events })));
const EventPage = lazy(() => import("./pages/EventPage").then((m) => ({ default: m.EventPage })));
const Join = lazy(() => import("./pages/Join").then((m) => ({ default: m.Join })));
const PublicPage = lazy(() => import("./pages/public/PublicPage").then((m) => ({ default: m.PublicPage })));
const PreviewPage = lazy(() => import("./pages/public/PublicPage").then((m) => ({ default: m.PreviewPage })));
const Today = lazy(() => import("./pages/Today").then((m) => ({ default: m.Today })));
const Inbox = lazy(() => import("./pages/Inbox").then((m) => ({ default: m.Inbox })));
const Account = lazy(() => import("./pages/Account").then((m) => ({ default: m.Account })));
const Privacy = lazy(() => import("./pages/site/Legal").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("./pages/site/Legal").then((m) => ({ default: m.Terms })));
// The component gallery exists in development and in the build the journey tests run against.
const SHOW_GALLERY = import.meta.env.DEV || import.meta.env.VITE_GALLERY === "1";
const Gallery = SHOW_GALLERY
  ? lazy(() => import("./pages/Gallery").then((m) => ({ default: m.Gallery })))
  : null;

export function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/new" element={<Intake />} />
          <Route path="/new/generating" element={<Plan />} />
          <Route path="/signin" element={<Auth mode="signin" />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/join/:token" element={<Join />} />
          <Route path="/e/:token" element={<PublicPage kind="site" />} />
          <Route path="/r/:token" element={<PublicPage kind="rsvp" />} />
          <Route path="/h/:token" element={<PublicPage kind="helper" />} />
          <Route path="/v/:token" element={<PublicPage kind="vendor" />} />
          <Route path="/s/:token" element={<PublicPage kind="shifts" />} />
          <Route path="/fund/:token" element={<PublicPage kind="fund" />} />
          <Route path="/a/:token" element={<PublicPage kind="album" />} />
          <Route path="/stalls/:token" element={<PublicPage kind="stalls" />} />
          <Route path="/gate/:token" element={<PublicPage kind="gate" />} />
          <Route path="/preview/:kind/:eventId/:target?" element={<PreviewPage />} />
          <Route path="/events" element={<Private>{<Events />}</Private>} />
          <Route path="/events/:id/:tab?" element={<Private>{<EventPage />}</Private>} />
          <Route path="/today" element={<Private>{<Today />}</Private>} />
          <Route path="/account" element={<Private>{<Account />}</Private>} />
          <Route path="/inbox" element={<Private>{<Inbox />}</Private>} />
          {Gallery && <Route path="/gallery" element={<Gallery />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toasts />
      <AccountSync />
    </ErrorBoundary>
  );
}

/** Screens that need someone signed in, to an account or to the demo. */
function Private({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const { pathname } = useLocation();
  if (state.session.signedIn) return children;
  // A returning visitor may still have a session cookie; wait for the check before sending them away.
  if (state.account.status === "unknown") return <Loading />;
  return <Navigate to={`/signin?next=${pathname}`} replace />;
}

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <Spinner label="Loading" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper p-6 text-center">
      <Logo to="/" />
      <h1 className="font-serif text-4xl">This page isn't part of the plan</h1>
      <Link to="/" className="btn btn-primary">
        Go home
      </Link>
    </div>
  );
}
