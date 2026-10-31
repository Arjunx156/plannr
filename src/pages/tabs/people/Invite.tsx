import { type FormEvent, useState } from "react";
import { Field } from "../../../components/fields";
import type { PlannrEvent } from "../../../data/types";
import { api, inviteUrl } from "../../../lib/api";
import { ROLE_LABEL, type Role } from "../../../shared/types";
import { toast, useStore } from "../../../store/store";
import { waLink } from "../links";

const SIDES = ["Bride's side", "Groom's side", "Family", "Friends", "Volunteers"];
/** Committees name roles instead; "Treasurer" decides on expenses. */
const COMMITTEE = ["Treasurer", "Secretary", "President", "Volunteers"];

type InviteRole = Exclude<Role, "owner">;

/** A link that brings someone into the plan as a co-planner or a viewer, with their side or committee role. */
export function Invite({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const [role, setRole] = useState<InviteRole>("planner");
  const [side, setSide] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  // Changing who the link is for makes a new one, so an old link never grants the wrong role.
  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setLink("");
    };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await api.createInvite(ev.id, role, side.trim() || null);
      setLink(inviteUrl(token));
    } catch (err) {
      dispatch(toast((err as Error).message));
    }
    setBusy(false);
  };

  return (
    <section
      aria-label="Invite people"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
    >
      <h2 className="font-serif text-[24px]">Invite people</h2>
      <form onSubmit={create} className="flex flex-col gap-4">
        <RolePicker value={role} onChange={change(setRole)} />
        <SideField community={ev.layout === "community"} value={side} onChange={change(setSide)} />
        {!link && (
          <button type="submit" className="btn btn-primary self-start" disabled={busy}>
            {busy ? "Creating…" : "Create invite link"}
          </button>
        )}
      </form>
      {link && <InviteLink ev={ev} link={link} role={role} side={side.trim()} />}
    </section>
  );
}

function RolePicker({ value, onChange }: { value: InviteRole; onChange: (role: InviteRole) => void }) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="label mb-2">They can</legend>
      <div className="flex flex-wrap gap-2">
        {(["planner", "viewer"] as const).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={value === r}
            className="chip"
            onClick={() => onChange(r)}
          >
            {r === "planner" ? "Plan with you" : "Only view"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

interface SideProps {
  community: boolean;
  value: string;
  onChange: (side: string) => void;
}

/** A family side, or for a committee a role; the Treasurer's decides on expenses. */
function SideField({ community, value, onChange }: SideProps) {
  return (
    <Field
      label={community ? "Committee role (optional)" : "Side (optional)"}
      htmlFor="invite-side"
      hint={
        community
          ? "Shows next to their name. Once someone is the Treasurer, only they or the owner approve expenses."
          : "Shows next to their name, so everyone knows who's who."
      }
    >
      <input
        id="invite-side"
        className="field"
        list="invite-sides"
        value={value}
        maxLength={60}
        onChange={(e) => onChange(e.target.value)}
        placeholder={community ? "Treasurer" : "Groom's side"}
      />
      <datalist id="invite-sides">
        {(community ? COMMITTEE : SIDES).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  );
}

interface LinkProps {
  ev: PlannrEvent;
  link: string;
  role: InviteRole;
  side: string;
}

/** The invite link, to copy or send on WhatsApp. */
function InviteLink({ ev, link, role, side }: LinkProps) {
  const { dispatch } = useStore();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      dispatch(toast("Invite link copied."));
    } catch {
      dispatch(toast("Couldn't copy. Select the link and copy it yourself."));
    }
  };
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-sand p-4">
      <label htmlFor="invite-link" className="label">
        Invite link · works for 14 days
      </label>
      <input
        id="invite-link"
        className="field font-mono text-xs"
        readOnly
        value={link}
        onFocus={(e) => e.target.select()}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
          Copy link
        </button>
        <a
          className="btn btn-outline btn-sm"
          href={waLink(`Join me in planning ${ev.name} on Plannr: ${link}`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on WhatsApp
        </a>
      </div>
      <span className="text-xs text-muted">
        Anyone with this link can join as {ROLE_LABEL[role].toLowerCase()}
        {side ? ` on ${side}` : ""}. You can change their role or remove them here.
      </span>
    </div>
  );
}
