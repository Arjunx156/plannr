import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error?: Error;
}

/** A failed screen shows a way back instead of a blank page. The plan itself is safe in storage. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[plannr] screen crashed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // After a new release, an old tab can ask for code that no longer exists.
    const stale = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(
      error.message,
    );
    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper p-6 text-center"
      >
        <span className="font-serif text-[28px] italic">Plannr</span>
        <h1 className="max-w-[520px] font-serif text-4xl leading-[1.1]">
          {stale ? "Plannr has been updated" : "Something on this screen broke"}
        </h1>
        <p className="m-0 max-w-[460px] text-body">
          {stale
            ? "Reload to get the latest version. Your plans are saved."
            : "Your plans are saved. Reload to try again, or go back to your events."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a href="/events" className="btn btn-outline">
            My events
          </a>
        </div>
        {!stale && import.meta.env.DEV && (
          <pre className="max-w-full overflow-auto rounded-lg bg-sand p-3 text-left text-xs">
            {error.message}
          </pre>
        )}
      </div>
    );
  }
}
