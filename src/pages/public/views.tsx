import type { ReactNode } from "react";
import type { PublicView } from "../../shared/public";
import { AlbumPage } from "./AlbumPage";
import { FundPage } from "./FundPage";
import { GatePage } from "./GatePage";
import { HelperPage } from "./HelperPage";
import { RsvpPage } from "./RsvpPage";
import { ShiftsPage } from "./ShiftsPage";
import { SitePage } from "./SitePage";
import { StallsPage } from "./StallsPage";
import type { Act } from "./shell";
import { VendorPage } from "./VendorPage";

type Kind = PublicView["kind"];
type Upload = Parameters<typeof AlbumPage>[0]["upload"];
/** A shared-link page takes its own slice of the plan; pages ignore the props they don't need. */
type PageFor<K extends Kind> = (props: {
  view: Extract<PublicView, { kind: K }>;
  act?: Act | undefined;
  preview?: ReactNode;
  upload?: Upload;
}) => ReactNode;

/** One page per kind of link; a new kind fails to compile until it has one. */
const PAGES: { [K in Kind]: PageFor<K> } = {
  rsvp: RsvpPage,
  site: SitePage,
  helper: HelperPage,
  vendor: VendorPage,
  shifts: ShiftsPage,
  fund: FundPage,
  stalls: StallsPage,
  album: AlbumPage,
  gate: GatePage,
};

/** The page for one kind of shared link. */
export function viewPage(view: PublicView, act?: Act, preview?: ReactNode, upload?: Upload) {
  // TypeScript can't tie PAGES[view.kind] to view's own kind, so it is widened here; PAGES checks each pair.
  const Page = PAGES[view.kind] as PageFor<Kind>;
  return <Page view={view} act={act} preview={preview} upload={upload} />;
}
