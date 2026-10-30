/**
 * What the app needs to know about the demo before its sample events have loaded. The events
 * themselves (src/data/seed.ts) load only when someone opens the demo, so visitors who come for
 * the landing page or a guest's RSVP link never download them.
 */

/**
 * One signed-in planner, three live events in three roles: Ananya's elder sister and
 * co-planner on the wedding, Aarav's mother, and cultural secretary of Green Valley Society.
 */
export const DEMO_USER = {
  name: "Priya Menon",
  firstName: "Priya",
  initials: "PM",
  plan: "Early access",
  city: "Kochi, Kerala",
  language: "English",
};

/** The sample events' ids, so the planner's own events can be told apart from them. */
export const SEED_IDS = ["ananya-rohan", "aarav-6", "green-valley-mela", "amma-achan-35"];

/** Bump when the sample events change, so returning demo visitors see the new ones. */
export const SEED_REVISION = 5;
