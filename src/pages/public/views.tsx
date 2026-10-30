import type { ReactNode } from "react";
import type { PublicView } from "../../shared/public";
import { FundPage, GatePage, StallsPage } from "./CommunityPages";
import { AlbumPage, RsvpPage, SitePage } from "./GuestPages";
import type { Act } from "./shell";
import { HelperPage, ShiftsPage, VendorPage } from "./TeamPages";

/** The page for one kind of shared link. */
export function viewPage(
  view: PublicView,
  act?: Act,
  preview?: ReactNode,
  upload?: Parameters<typeof AlbumPage>[0]["upload"],
) {
  switch (view.kind) {
    case "rsvp":
      return <RsvpPage view={view} act={act} preview={preview} />;
    case "site":
      return <SitePage view={view} preview={preview} />;
    case "helper":
      return <HelperPage view={view} act={act} preview={preview} />;
    case "vendor":
      return <VendorPage view={view} preview={preview} />;
    case "shifts":
      return <ShiftsPage view={view} act={act} preview={preview} />;
    case "fund":
      return <FundPage view={view} preview={preview} />;
    case "stalls":
      return <StallsPage view={view} act={act} preview={preview} />;
    case "album":
      return <AlbumPage view={view} upload={upload} preview={preview} />;
    case "gate":
      return <GatePage view={view} act={act} preview={preview} />;
  }
}
