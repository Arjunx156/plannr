import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** A QR code drawn as one SVG path, so it stays sharp at any size and prints well. */
export function QrCode({ text, size = 200, label }: { text: string; size?: number; label: string }) {
  const { n, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let path = "";
    for (let r = 0; r < count; r++)
      for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { n: count + 4, d: path };
  }, [text]);
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className="rounded-lg bg-white"
      shapeRendering="crispEdges"
    >
      <path d={d} fill="#1f1b16" />
    </svg>
  );
}
