import type { CommunityEvent } from "../types";
import { melaRecords } from "./melaRecords";

/** The demo community event: a housing society's mela with stalls, sponsors, permits and volunteers. */
export const mela: CommunityEvent = {
  id: "green-valley-mela",
  kind: "community",
  layout: "community",
  name: "Green Valley Society Mela",
  role: "ORGANISER",
  hue: "leaf",
  eyebrow: "Community event · Green Valley Society, Kakkanad · {long:2026-11-07}",
  navMeta: "Community · Society grounds · {short:2026-11-07}",
  listMeta: "Stalls + cultural night · {short:2026-11-07} · 600 attendees · 12 volunteers",
  date: "2026-11-07",
  ...melaRecords,
  countdown: { label: "Mela day in", line: "Gates open 4 pm · stalls, rangoli and a cultural night" },
  segments: [
    { id: "all", label: "Whole event", line: "Gates open 4 pm · stalls, rangoli and a cultural night" },
    { id: "stalls", label: "Stalls · 4–10 pm", line: "Stall setup from 2 pm · 18 of 30 booked" },
    {
      id: "rangoli",
      label: "Rangoli contest · 4 pm",
      line: "Judging at 6 pm · prizes from the society fund",
    },
    { id: "night", label: "Cultural night · 7–10 pm", line: "Sound check 5:30 pm · ends 10 pm sharp" },
  ],
  funds: {
    budget: 250000,
    spent: 96500,
    sources: [
      // Sponsorships and stall fees are added from the sponsor and stall lists.
      { label: "Society fund", expected: 150000, received: 150000, note: "received", tone: "ok" },
    ],
    approvals: [
      {
        id: "a1",
        label: "Sound & lighting advance · Lumen Events",
        by: "Arjun",
        amount: 25000,
        status: "pending",
      },
      { id: "a2", label: "Rangoli colours and prizes", by: "Rekha", amount: 6000, status: "pending" },
    ],
  },
  tasks: {
    total: 54,
    doneBefore: 26,
    list: [
      {
        id: "m1",
        title: "Collect stall fees from 6 pending stalls",
        who: "Farhan (volunteer)",
        due: "2026-09-26",
        done: false,
      },
      {
        id: "m2",
        title: "File police permission for loudspeaker use",
        who: "You",
        due: "2026-10-01",
        done: false,
      },
      { id: "m3", title: "Confirm the third sponsor's payment", who: "You", due: "2026-10-02", done: false },
    ],
  },
  permits: [
    { label: "Police permission (sound)", status: "Not filed", tone: "warn", permit: true },
    { label: "Fire safety check for diya stalls", status: "In progress", tone: "due", permit: true },
    { label: "Corporation stall licence", status: "Approved", tone: "ok", permit: true },
    { label: "Sound & lighting · Lumen Events", status: "Advance awaiting approval", tone: "due" },
    { label: "Security · 6 guards", status: "Booked", tone: "ok" },
    { label: "Sanitation · 4 mobile toilets", status: "Booked", tone: "ok" },
  ],
  passes: { issued: 412, capacity: 600 },
  stalls: { booked: 18, total: 30 },
  shifts: {
    slots: ["2–5 pm · setup", "5–8 pm · stalls", "8–11 pm · show & clean"],
    roles: [
      {
        role: "Entry & passes",
        slots: [
          { need: 2, names: ["Farhan", "Divya"] },
          { need: 2, names: ["Joseph", "Anu"] },
          { need: 2, names: ["Sanjay"] },
        ],
      },
      {
        role: "Stall coordination",
        slots: [
          { need: 2, names: ["Rekha", "Vinod"] },
          { need: 2, names: ["Rekha", "Sanjay"] },
          { need: 1, names: ["Vinod"] },
        ],
      },
      {
        role: "Stage & sound",
        slots: [
          { need: 0, names: [] },
          { need: 1, names: ["Arjun"] },
          { need: 2, names: ["Arjun", "Meera"] },
        ],
      },
      {
        role: "Food safety",
        slots: [
          { need: 0, names: [] },
          { need: 2, names: [] },
          { need: 1, names: ["Thomas"] },
        ],
      },
      {
        role: "Parking",
        slots: [
          { need: 0, names: [] },
          { need: 2, names: ["Ravi", "Divya"] },
          { need: 1, names: ["Ravi"] },
        ],
      },
      {
        role: "First aid",
        slots: [
          { need: 0, names: [] },
          { need: 1, names: ["Dr. Leela"] },
          { need: 1, names: ["Dr. Leela"] },
        ],
      },
      {
        role: "Clean-up",
        slots: [
          { need: 0, names: [] },
          { need: 0, names: [] },
          { need: 2, names: [] },
        ],
      },
    ],
  },
  volunteers: [
    "Farhan",
    "Divya",
    "Joseph",
    "Anu",
    "Sanjay",
    "Rekha",
    "Vinod",
    "Arjun",
    "Meera",
    "Thomas",
    "Ravi",
    "Dr. Leela",
  ],
  notices: [],
  assistant: {
    intro: "",
    chips: [
      "Draft the police permission application",
      "Who's free for food safety 5–8 pm?",
      "Summarise funds for the committee",
    ],
    thread: [],
  },
  home: {
    budgetNote: { text: "2 expenses awaiting approval", tone: "idle" },
    readinessNote: { text: "Police permission not filed", tone: "warn" },
  },
};
