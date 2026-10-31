import { Modal } from "../../../components/overlays";
import type { Household } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { HouseholdForm } from "./householdForm";

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
}) {
  return (
    <Modal open={!!household} onClose={onClose} title="Household" side="right" width={480}>
      {household && (
        <HouseholdForm key={household.id} ev={ev} h={household} onClose={onClose} sides={sides} />
      )}
    </Modal>
  );
}
