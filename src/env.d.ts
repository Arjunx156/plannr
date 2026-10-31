/** The build-time settings the browser code reads, beyond Vite's own MODE, DEV and PROD. */
interface ImportMetaEnv {
  /** "1" keeps the component gallery in a production build, for the journey tests. */
  readonly VITE_GALLERY?: string;
}

/** Browser features Plannr uses where they exist, which TypeScript's DOM types don't describe yet. */
interface Window {
  /** Speech to text: standard in some browsers, prefixed in Chrome and Safari. */
  SpeechRecognition?: import("./lib/voice").RecognitionCtor;
  webkitSpeechRecognition?: import("./lib/voice").RecognitionCtor;
  /** QR reading: Chrome on Android has it; Safari and Firefox don't. */
  BarcodeDetector?: import("./components/scanner").DetectorClass;
}

/** The part of Trusted Types Plannr uses: one policy that vouches for script URLs. */
interface TrustedScriptURL {
  toString(): string;
}

/** A named set of rules that turns strings into values a script sink accepts. */
interface TrustedTypePolicy {
  createScriptURL(url: string): TrustedScriptURL;
}

/** `window.trustedTypes`, where the browser enforces Trusted Types. */
interface TrustedTypePolicyFactory {
  createPolicy(name: string, rules: { createScriptURL(url: string): string }): TrustedTypePolicy;
}

interface Window {
  /** Present where the browser supports Trusted Types; the CSP then refuses plain strings at script sinks. */
  trustedTypes?: TrustedTypePolicyFactory;
}

interface ServiceWorkerContainer {
  /** Under Trusted Types the worker's URL must come from a policy. */
  register(scriptURL: TrustedScriptURL, options?: RegistrationOptions): Promise<ServiceWorkerRegistration>;
}

interface WindowEventMap {
  /** Chrome's offer to install the app, kept so Plannr can show it at a better moment. */
  beforeinstallprompt: import("./lib/device").InstallPrompt;
}
