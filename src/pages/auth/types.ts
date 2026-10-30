/** What the sign-in page is busy with, so only that button shows progress. */
export type Busy = "" | "google" | "send" | "verify" | "guest";

export type Mode = "signup" | "signin";

/** A guest adding an email or Google keeps every plan; the server moves them across. */
export type Variant = Mode | "upgrade";
