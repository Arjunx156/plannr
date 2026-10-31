import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { HttpError } from "./plans";

/**
 * Photos for the shared album, kept in the project's Vercel Blob store. The browser never
 * holds a storage key: it sends the image here, the server checks it really is an image of
 * a sensible size and stores it under the event's own folder.
 */

export const MAX_PHOTO_BYTES = 4_000_000;

export type StorePhoto = (eventId: string, bytes: Uint8Array, type: string) => Promise<string>;

/** What the bytes say the file is, whatever the request claimed. */
export function imageType(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | undefined {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const riff = String.fromCharCode(...b.slice(0, 4));
  const webp = String.fromCharCode(...b.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return undefined;
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export function blobStore(token: string | undefined): StorePhoto | undefined {
  if (!token) return undefined;
  return async (eventId, bytes, type) => {
    const ext = EXT[type as keyof typeof EXT] ?? "jpg";
    const blob = await put(`albums/${eventId}/${randomUUID()}.${ext}`, Buffer.from(bytes), {
      access: "public",
      contentType: type,
      token,
      addRandomSuffix: false,
    });
    return blob.url;
  };
}

/** Reads and checks an uploaded photo: an image, under the size limit. */
export async function readPhoto(req: Request): Promise<{ bytes: Uint8Array; type: string }> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_PHOTO_BYTES) throw new HttpError(413, "That photo is too large. Try a smaller one.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0) throw new HttpError(400, "The photo didn't come through");
  if (bytes.length > MAX_PHOTO_BYTES) throw new HttpError(413, "That photo is too large. Try a smaller one.");
  const type = imageType(bytes);
  if (!type) throw new HttpError(415, "Plannr takes JPG, PNG or WebP photos");
  return { bytes, type };
}

/** Only photos in this event's own folder of a Blob store count as uploaded through Plannr. */
export function isEventPhoto(url: string, eventId: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".public.blob.vercel-storage.com") &&
      u.pathname.startsWith(`/albums/${eventId}/`)
    );
  } catch {
    return false;
  }
}
