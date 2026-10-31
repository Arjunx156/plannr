import type { GuestLang } from "../guestText";
import { en, type LinkText } from "./en";
import { hi } from "./hi";
import { ml } from "./ml";
import { ta } from "./ta";

const TEXT: Record<GuestLang, LinkText> = { en, ml, hi, ta };

export function linkText(lang: GuestLang): LinkText {
  return TEXT[lang];
}
