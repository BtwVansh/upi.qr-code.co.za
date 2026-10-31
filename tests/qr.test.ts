import { describe, expect, it } from "vitest";
import { generateQrDataUrl } from "@/lib/qr";
import { buildUpiUri } from "@/lib/upi";

function pngFromDataUrl(dataUrl: string): Buffer {
  const [, base64] = dataUrl.split(",", 2);
  return Buffer.from(base64, "base64");
}

describe("generateQrDataUrl", () => {
  it("renders a PNG data URL for a UPI payment URI", async () => {
    const uri = buildUpiUri({
      payeeVpa: "merchant@upi",
      amount: "49.00",
      note: "Coffee",
    });
    const dataUrl = await generateQrDataUrl(uri, 640);

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    const png = pngFromDataUrl(dataUrl);
    expect(png.byteLength).toBeGreaterThan(500);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    // PNG IHDR width/height at byte offsets 16 and 20 (big-endian).
    expect(png.readUInt32BE(16)).toBe(640);
    expect(png.readUInt32BE(20)).toBe(640);
  });

  it("accepts the maximum note length", async () => {
    const dataUrl = await generateQrDataUrl(
      buildUpiUri({
        payeeVpa: "merchant@upi",
        amount: "100000",
        note: "N".repeat(50),
      }),
    );
    expect(dataUrl).toContain("image/png");
  });
});
