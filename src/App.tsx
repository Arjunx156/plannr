import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Logo, Spinner, Toasts } from "./components/ui";
import { Landing } from "./pages/Landing";

// The landing page ships in the first bundle; every other screen loads when it is opened.
const Intake = lazy(() => import("./pages/Intake").then((m) => ({ default: m.Intake })));
const Plan = lazy(() => import("./pages/Plan").then((m) => ({ default: m.Plan })));
const Auth = lazy(() => import("./pages/Auth").then((m) => ({ default: m.Auth })));
const Onboarding = lazy(() => import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })));
const Events = lazy(() => import("./pages/Events").then((m) => ({ default: m.Events })));
const EventPage = lazy(() => import("./pages/EventPage").then((m) => ({ default: m.EventPage })));
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
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventPage />} />
          {Gallery && <Route path="/gallery" element={<Gallery />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toasts />
    </ErrorBoundary>
  );
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
