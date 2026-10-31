import { type ReactNode, useState } from "react";
import type { AlbumView } from "../../shared/public";
import { Card, PublicShell, useLinkLang } from "./shell";

/** The shared album: everyone's photos from the day, and a way to add yours. */
export function AlbumPage({
  view,
  upload,
  preview,
}: {
  view: AlbumView;
  upload?: (file: File, by: string, caption: string) => Promise<void>;
  preview?: ReactNode;
}) {
  const { t, shell } = useLinkLang(view.event);
  const [by, setBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !upload) return;
    if (by.trim().length < 2) {
      setError(t.albumName);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await upload(file, by.trim(), "");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <PublicShell event={view.event} eyebrow={t.album} preview={preview} {...shell}>
      <Card label={t.addPhoto}>
        <label htmlFor="album-by" className="label">
          {t.yourName}
        </label>
        <input
          id="album-by"
          className="field"
          value={by}
          maxLength={80}
          autoComplete="name"
          onChange={(e) => setBy(e.target.value)}
        />
        <label
          className={`btn btn-primary self-start ${!upload || busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? t.uploading : t.addPhoto}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={!upload || busy}
            onChange={(e) => pick(e.target.files)}
          />
        </label>
        {!upload && <span className="text-xs text-muted">{t.albumClosed}</span>}
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-rust-ink">
            {error}
          </p>
        )}
      </Card>
      {view.photos.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
          {view.photos.map((p) => (
            <li key={p.id} className="flex flex-col gap-1">
              <img
                src={p.url}
                alt={p.caption || `Photo from ${p.by}`}
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover"
              />
              <span className="text-xs text-muted">{p.by}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-center text-sm text-muted">{t.noPhotos}</p>
      )}
    </PublicShell>
  );
}
