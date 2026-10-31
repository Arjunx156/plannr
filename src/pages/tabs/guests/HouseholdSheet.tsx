import type { JSX } from "react";
import { Modal } from "../../../components/overlays";
import type { Household } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { HouseholdForm } from "./householdForm";

/** One household's details, answers and stay, editable in a side sheet. */
export function HouseholdSheet({
  ev,
  household,
  onClose,
  sides,
}: {
  ev: PlannrEvent;
  household: Household | undefined;
  onClose: () => void;
  sides: string[];
}): JSX.Element {
  return (
    <Modal open={!!household} onClose={onClose} title="Household" side="right" width={480}>
      {household && (
        <HouseholdForm key={household.id} ev={ev} h={household} onClose={onClose} sides={sides} />
      )}
    </Modal>
  );
}
