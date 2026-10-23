import { Link, Route, Routes } from "react-router";
import { Logo, Toasts } from "./components/ui";
import { Auth } from "./pages/Auth";
import { EventPage } from "./pages/EventPage";
import { Events } from "./pages/Events";
import { Intake } from "./pages/Intake";
import { Landing } from "./pages/Landing";
import { Onboarding } from "./pages/Onboarding";
import { Plan } from "./pages/Plan";

export function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/new" element={<Intake />} />
        <Route path="/new/generating" element={<Plan />} />
        <Route path="/signin" element={<Auth mode="signin" />} />
        <Route path="/signup" element={<Auth mode="signup" />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toasts />
    </>
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
