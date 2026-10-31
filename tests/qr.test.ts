import { describe, expect, it } from "vitest";
import { generateQrPng } from "@/lib/qr";
import { buildUpiUri } from "@/lib/upi";

describe("generateQrPng", () => {
  it("renders a PNG buffer for a UPI payment URI", async () => {
    const uri = buildUpiUri({
      payeeVpa: "merchant@upi",
      payeeName: "Demo Merchant",
      amount: "49.00",
      note: "Coffee",
    });
    const png = await generateQrPng(uri, 640);

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.byteLength).toBeGreaterThan(500);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    // PNG IHDR width at byte offset 16 (big-endian).
    expect(png.readUInt32BE(16)).toBe(640);
    expect(png.readUInt32BE(20)).toBe(640);
  });

  it("accepts long note values without breaking", async () => {
    const png = await generateQrPng(
      buildUpiUri({
        payeeVpa: "merchant@upi",
        payeeName: "A".repeat(99),
        amount: "100000",
        note: "N".repeat(50),
      }),
    );
    expect(png.byteLength).toBeGreaterThan(500);
  });
});
