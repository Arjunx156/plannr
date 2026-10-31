import type { JSX } from "react";
import type { PlannrEvent } from "../../data/types";
import { NotCommunity } from "./community";
import { Stalls } from "./stalls/Stalls";

/** /events/:id/stalls — stall requests, fees, passes and the gate. */
export function StallsTab({ ev }: { ev: PlannrEvent }): JSX.Element {
  if (ev.layout !== "community") return <NotCommunity ev={ev} title="Stalls & passes" />;
  return <Stalls ev={ev} />;
}
