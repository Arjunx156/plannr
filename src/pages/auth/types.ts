/** What the sign-in page is busy with, so only that button shows progress. */
export type Busy = "" | "google" | "send" | "verify" | "guest";

/** Whether the auth page is creating an account or signing in. */
export type Mode = "signup" | "signin";

/** A guest adding an email or Google keeps every plan; the server moves them across. */
export type Variant = Mode | "upgrade";
