import { createElement, type JSX, type ReactNode } from "react";
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
/** What every shared-link page is given besides its view; pages ignore the props they don't need. */
interface PageExtras {
  act?: Act | undefined;
  preview?: ReactNode;
  upload?: Upload;
}
/** A shared-link page takes its own slice of the plan. */
type PageFor<K extends Kind> = (props: { view: Extract<PublicView, { kind: K }> } & PageExtras) => ReactNode;

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
export function viewPage(view: PublicView, act?: Act, preview?: ReactNode, upload?: Upload): JSX.Element {
  return pageFor(view.kind, view, { act, preview, upload });
}

/** Looks up a page by a generic kind, which lets TypeScript match the page to its view. */
function pageFor<K extends Kind>(
  kind: K,
  view: Extract<PublicView, { kind: K }>,
  extras: PageExtras,
): JSX.Element {
  return createElement(PAGES[kind], { view, ...extras });
}
