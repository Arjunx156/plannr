import { Link } from "react-router";
import { Prose, SitePage } from "./siteLayout";

export function Privacy() {
  return (
    <SitePage
      title="Privacy"
      description="What Plannr stores, who can see it, where it goes, and how to download or delete it."
      eyebrow="Privacy"
      heading="Your plans are yours"
      lead="Plannr keeps what you put into your plans so you and the people you invite can use them. It doesn't sell data, show ads or track you across other sites."
    >
      <Prose>
        <h2>What Plannr stores</h2>
        <ul>
          <li>
            Your account: your name, and your email address if you sign in with Google or an email code.
          </li>
          <li>
            Your plans: budgets, tasks, vendors, guest lists and everything else you add, including names and
            phone numbers of guests and vendors you enter.
          </li>
          <li>Answers and photos that guests send through the links you share with them.</li>
          <li>A history of changes, so co-planners can see who changed what and undo it.</li>
        </ul>
        <p>
          Guest accounts (without an email) work only in the browser that made them. The demo stores
          everything in your browser and sends nothing to Plannr's servers.
        </p>

        <h2>Who can see it</h2>
        <ul>
          <li>
            The people you invite to a plan, with the role you give them. Viewers can see but not change it.
          </li>
          <li>
            Someone with a link you share sees only that page: a household sees its own invitation, a vendor
            their call sheet, a helper their own jobs, residents the fund totals. Links can be turned off at
            any time.
          </li>
          <li>
            The event website is public only once you publish it, and search engines list it only if you allow
            that.
          </li>
        </ul>

        <h2>Services that handle your data</h2>
        <ul>
          <li>Vercel hosts the app and stores album photos.</li>
          <li>Neon stores the database.</li>
          <li>
            Google Gemini writes drafts and answers questions. Only what the request needs is sent, for
            example the plan you are asking about or the photo of a bill you chose to read.
          </li>
          <li>Resend delivers sign-in codes by email, when email sign-in is switched on.</li>
          <li>
            Open-Meteo provides the weather forecast for a function day. Only the town's name and the dates
            are sent.
          </li>
          <li>Google provides sign-in if you choose “Continue with Google”.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          One cookie keeps you signed in. Plannr counts visits and new plans as totals for each day, with no
          cookies, names or addresses attached.
        </p>

        <h2>Your rights</h2>
        <p>
          You can download everything Plannr holds about you, and delete your account, from{" "}
          <Link to="/account" className="link">
            Account and privacy
          </Link>
          . Deleting your account removes your plans, unless you shared them with co-planners: those stay with
          them, and the longest-standing co-planner becomes the owner. These rights follow India's Digital
          Personal Data Protection Act.
        </p>
      </Prose>
    </SitePage>
  );
}

export function Terms() {
  return (
    <SitePage
      title="Terms"
      description="The terms for using Plannr during early access."
      eyebrow="Terms"
      heading="Terms of use"
      lead="Plannr is in early access and free to use. These are the few rules that keep it working well for everyone."
    >
      <Prose>
        <h2>Using Plannr</h2>
        <ul>
          <li>
            Use it to plan real events, and only add people's details when you have a reason to, such as
            inviting them.
          </li>
          <li>Don't use shared links or the AI to send spam, harass anyone, or anything unlawful.</li>
          <li>The AI has a fair daily limit per person so that it stays free; it resets each day.</li>
        </ul>
        <h2>Your content</h2>
        <p>
          What you put into Plannr stays yours. You allow Plannr to store it and show it to the people and
          links you choose, which is what the service needs to work.
        </p>
        <h2>Advice, not guarantees</h2>
        <p>
          Budgets, estimates, drafts and suggestions are a starting point. Check amounts, dates and vendor
          details yourself before paying or confirming anything. Plannr isn't a party to your agreements with
          vendors.
        </p>
        <h2>Changes</h2>
        <p>
          Plannr is free during early access. If paid plans arrive, nothing will be charged without asking you
          first, and events you started during early access stay free to finish. Features may change while
          Plannr grows; we'll say so in the app before anything you rely on goes away.
        </p>
      </Prose>
    </SitePage>
  );
}
