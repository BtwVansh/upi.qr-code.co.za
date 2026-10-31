import QRCode from "qrcode";

const QR_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 2,
  color: {
    dark: "#0B0B0F",
    light: "#FFFFFF",
  },
};

/**
 * Generates a PNG data URL in the browser (or in a Node test environment).
 * The caller supplies the UPI payment URI, never the website URL.
 */
export async function generateQrDataUrl(
  payload: string,
  width = 1024,
): Promise<string> {
  return QRCode.toDataURL(payload, {
    ...QR_OPTIONS,
    type: "image/png",
    width,
  });
}

/** Triggers a PNG download without a server endpoint. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
