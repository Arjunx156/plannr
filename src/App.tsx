import { Route, Routes } from "react-router";
import { Toasts } from "./components/ui";
import { Landing } from "./pages/Landing";

export function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
      </Routes>
      <Toasts />
    </>
  );
}
