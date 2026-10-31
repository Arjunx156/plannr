/** CSS custom properties by name. */
export type CssVars = Record<`--${string}`, string>;

/**
 * A ref that sets CSS custom properties through the CSSOM. The content security policy allows that,
 * unlike a `style` attribute, so values that come from data (a bar's width, a family's colour) need
 * no 'unsafe-inline'. Classes read them: `w-(--w) bg-(--c)`.
 */
export function cssVars(vars: CssVars): (el: HTMLElement | null) => void {
  return (el) => {
    if (el) for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
  };
}

/** A fraction as a CSS percentage, held between 0% and 100%; nothing to measure against reads as 0%. */
export function percent(fraction: number): string {
  return Number.isFinite(fraction) ? `${Math.max(0, Math.min(1, fraction)) * 100}%` : "0%";
}
