# Accessibility

Plannr is for families, and families include grandparents on old phones, cousins who use a screen reader, and
an uncle who plans everything with the keyboard. The target is WCAG 2.2 at level AA on every page, the
planner's and the shared links alike. This page says how that is checked, how to use Plannr without a mouse,
and what is still short of the mark.

## How it's checked

Every check below runs in CI against the production build, and a failure blocks the release.

| What | How | Where |
| --- | --- | --- |
| WCAG 2.2 A and AA, and axe's best practices | An axe scan of every main page, on a desktop and on a Pixel 7; any serious or critical finding fails | `e2e/a11y.e2e.ts`, `e2e/workspace.e2e.ts`, `e2e/device.e2e.ts` |
| Reflow (1.4.10) | Every main page at 320 CSS pixels wide, with no sideways scrolling | `e2e/adapts.e2e.ts` |
| Resize text (1.4.4) | Every main page at 200% zoom still fits its width | `e2e/adapts.e2e.ts` |
| Less motion (2.3.3) | With reduced motion requested, no animation is still running on any main page | `e2e/adapts.e2e.ts` |
| High contrast themes | In forced colours, progress bars keep a visible fill and the main pages pass axe | `e2e/adapts.e2e.ts` |
| Keyboard (2.1.1) and visible focus (2.4.7) | A plan is started from the first page with the keyboard alone, and every stop on the way shows a focus ring | `e2e/adapts.e2e.ts` |
| Bypass blocks (2.4.1) | The first Tab reaches "Skip to content", and the next one lands in the page | `e2e/a11y.e2e.ts` |
| Landmarks and headings | The structure screen readers navigate by (banner, navigation, main, one level-one heading) is held as an ARIA snapshot on three key pages | `e2e/adapts.e2e.ts` |
| Changes of screen | Moving between screens is announced, and focus moves to the new content | `e2e/a11y.e2e.ts` |
| Language of parts (3.1.2) | Shared pages in Malayalam, Hindi or Tamil mark their language, so screen readers switch voice | `e2e/a11y.e2e.ts` |
| Shared pieces | Bars carry `role="progressbar"` with a value and a name; spinners speak only when they stand alone | `tests/components.test.tsx` |

## Using Plannr with a keyboard

| Key | Where | What it does |
| --- | --- | --- |
| Tab, Shift+Tab | Everywhere | Moves between controls, in reading order, with a focus ring on each |
| Tab, then Enter | Any screen | "Skip to content" jumps past the header to the page |
| Ctrl+K or ⌘K | Signed in | Opens search across plans, people and screens; ↑ ↓ to move, Enter to open, Esc to close |
| Enter | The assistant and the intake chat | Sends the message; Shift+Enter starts a new line |
| Space or Enter | "Hold to speak" | Starts voice input, and stops it on the next press |
| Esc | Dialogs and menus | Closes them |

Dragging is only ever a shortcut. Seating a household by dragging it onto a table can also be done with the
table picker on the household itself.

## Also built in

- Text and controls meet AA contrast, which every axe scan checks. People who ask their system for more
  contrast get darker secondary text and borders.
- In a high contrast theme, progress bars, pressed chips and status pills are drawn in the theme's own colours.
- Small one-glyph buttons keep a target of at least 24 by 24 pixels (2.5.8), and every form field has a
  visible label or one for screen readers.
- Nothing flashes, nothing moves on its own for long, and reduced motion stops what does.

## Known limits

- Voice input uses the browser's speech recognition, which not every browser offers. Typing always works in
  its place.
- Scanning passes at the gate needs a camera and a browser that reads QR codes; everywhere else the gate
  offers a search by name instead.
- Automated checks find a large share of problems, not all of them. The keyboard journey covers starting a
  plan; a full screen reader audit with people who use one every day is still to be done.

## Reporting a barrier

If something in Plannr gets in your way, email 4rjunkrishnan@gmail.com with the page, what you were trying to
do, and the browser and assistive technology you use. Accessibility problems are treated as bugs, and fixed
first.
