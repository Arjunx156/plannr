import { z } from "zod";

/**
 * Shapes for every change the API accepts. Plans are shown to whole families on cheap
 * phones, so a change must be well-formed and modest in size before it touches one.
 * Unknown fields are dropped.
 */
export const str = (max = 200) => z.string().max(max);
/** A trimmed, non-empty name of at most `max` characters. */
export const name = (max = 120) => z.string().trim().min(1).max(max);
/** A record id. */
export const id = z.string().min(1).max(80);
/** A date as YYYY-MM-DD. */
export const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** A time as HH:MM, 24-hour. */
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
/** An amount in rupees, up to ₹100 crore. */
export const money = z.number().finite().min(0).max(1000000000);
// Digits, with the leading + the vendor form keeps for a number saved with its country code.
/** A phone number: 6 to 15 digits, with an optional leading +. */
export const phone = z.string().regex(/^\+?\d{6,15}$/);
/** A UPI id: name@bank. */
export const upi = z.string().regex(/^[\w.-]{2,64}@[\w.-]{2,32}$/);
/** How urgent something is. */
export const tone = z.enum(["warn", "due", "ok", "idle"]);
/** A language code: "en", "ml", "hi". */
export const lang = z.string().regex(/^[a-z]{2,3}$/);
/** An ISO timestamp, kept as text. */
export const stamp = str(40);
