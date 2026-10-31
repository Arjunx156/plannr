/** A WhatsApp link with the message filled in, to one number or to whoever they pick. */
export function waLink(text: string, phone?: string): string {
  const to = phone?.replace(/\D/g, "") ?? "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** A UPI payment link that opens any UPI app on the phone. */
export function upiLink(vpa: string, name: string, amount: number, note: string): string {
  const q = new URLSearchParams({
    pa: vpa,
    pn: name,
    am: String(Math.round(amount)),
    cu: "INR",
    tn: note.slice(0, 60),
  });
  return `upi://pay?${q.toString()}`;
}
