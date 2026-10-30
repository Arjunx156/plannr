import type { PayMethod } from "../../../data/types";

/** How a payment was made, in words. */
export const METHOD_LABEL: Record<PayMethod, string> = {
  upi: "UPI",
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
  cheque: "Cheque",
};
