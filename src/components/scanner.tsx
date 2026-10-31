import { useEffect, useRef, useState } from "react";
import { Modal } from "./overlays";

/**
 * Scanning QR codes with the phone's camera, where the browser can (Chrome on Android).
 * Elsewhere the caller offers a search by name instead.
 */

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorClass = new (opts: { formats: string[] }) => Detector;

/** The browser's QR reader, where it has one (Chrome on Android does; Safari and Firefox don't). */
export function detectorClass(): DetectorClass | undefined {
  // BarcodeDetector isn't in TypeScript's DOM types yet, so it's read by name.
  const found: unknown = Reflect.get(globalThis, "BarcodeDetector");
  return typeof found === "function" ? (found as DetectorClass) : undefined;
}

/** The camera view; calls `onCode` with the first QR code it reads. */
export function Scanner({
  onCode,
  onClose,
  title = "Scan an entry code",
  hint = "Plannr needs the camera to scan. Allow it in the browser, or search by name.",
}: {
  onCode: (text: string) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  // The camera starts once; a fresh callback each render mustn't restart it.
  const found = useRef(onCode);
  found.current = onCode;
  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector) return;
    let stream: MediaStream | undefined;
    let timer = 0;
    let stopped = false;
    const detector = new Detector({ formats: ["qr_code"] });
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          const text = codes[0]?.rawValue;
          if (text) found.current(text);
          else timer = window.setTimeout(tick, 250);
        };
        void tick();
      })
      .catch(() => setError(hint));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      for (const t of stream?.getTracks() ?? []) t.stop();
    };
  }, [hint]);
  return (
    <Modal open onClose={onClose} title={title} width={420}>
      {error ? (
        <p className="m-0 text-sm text-rust-ink">{error}</p>
      ) : (
        <video
          ref={video}
          className="aspect-square w-full rounded-xl bg-ink object-cover"
          playsInline
          muted
        />
      )}
    </Modal>
  );
}
