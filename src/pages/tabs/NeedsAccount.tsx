import type { ReactNode } from "react";
import { Link } from "react-router";
import type { PlannrEvent } from "../../data/types";
import { TabPage } from "./layout";

/** Shown in the demo, where nothing is shared and nothing is kept on a server. */
export function NeedsAccount({
  ev,
  title,
  children,
}: {
  ev: PlannrEvent;
  title: string;
  children: ReactNode;
}) {
  return (
    <TabPage eyebrow={ev.name} title={title}>
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6">
        <p className="m-0 max-w-[560px] text-[15px] leading-normal text-body">{children}</p>
        <Link to="/signup" className="btn btn-primary">
          Create a free account
        </Link>
      </div>
    </TabPage>
  );
}
