/**
 * Shrinking a photo before it uploads. The browser's image APIs are stood in for, so the test checks the
 * decisions: what's left alone, and when the original is kept after all.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { shrinkImage } from "../src/lib/images";

/** A browser that decodes any image as `width` × `height` and encodes the copy as `out`. */
function browser(width: number, height: number, out: Blob | null) {
  Reflect.set(globalThis, "createImageBitmap", async () => ({ width, height }));
  Reflect.set(globalThis, "document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toBlob: (done: (b: Blob | null) => void) => done(out),
    }),
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "createImageBitmap");
  Reflect.deleteProperty(globalThis, "document");
});

const photo = (bytes: number, type = "image/jpeg") => new Blob([new Uint8Array(bytes)], { type });

describe("shrinking a photo", () => {
  test("leaves files that aren't images, or a browser that can't decode them, alone", async () => {
    const pdf = photo(10, "application/pdf");
    expect(await shrinkImage(pdf)).toBe(pdf);
    const jpg = photo(10);
    expect(await shrinkImage(jpg)).toBe(jpg);
  });

  test("sends the smaller copy, and keeps the original when the copy isn't smaller", async () => {
    const small = photo(100);
    browser(3200, 1600, small);
    expect(await shrinkImage(photo(5000))).toBe(small);
    browser(800, 600, photo(9000));
    const original = photo(5000);
    expect(await shrinkImage(original)).toBe(original);
  });

  test("converts a format the server won't take, even when the copy is larger", async () => {
    const jpg = photo(9000);
    browser(800, 600, jpg);
    expect(await shrinkImage(photo(5000, "image/heic"))).toBe(jpg);
  });

  test("keeps the original when decoding fails", async () => {
    Reflect.set(globalThis, "createImageBitmap", async () => {
      throw new Error("unsupported");
    });
    const original = photo(5000);
    expect(await shrinkImage(original)).toBe(original);
  });
});
