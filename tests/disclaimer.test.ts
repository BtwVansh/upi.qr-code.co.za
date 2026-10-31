import { describe, expect, it } from "vitest";
import {
  DISCLAIMER_LOG_NOTE,
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_TITLE,
} from "@/lib/disclaimer";

describe("disclaimer copy", () => {
  it("uses the required notice title and paragraphs", () => {
    expect(DISCLAIMER_TITLE).toBe("Important Notice");
    expect(DISCLAIMER_PARAGRAPHS).toHaveLength(6);
    expect(DISCLAIMER_PARAGRAPHS[0]).toBe(
      "This website is an independent personal project designed to generate UPI payment QR codes and shareable payment links.",
    );
    expect(DISCLAIMER_PARAGRAPHS[1]).toBe(
      "We do not store your UPI ID or other submitted information in a website database.",
    );
    expect(DISCLAIMER_PARAGRAPHS[2]).toContain(
      "Your UPI ID will be included in the generated shareable URL",
    );
    expect(DISCLAIMER_PARAGRAPHS[5]).toContain(
      "issues arising from third-party payment applications",
    );
  });

  it("explains technical access logs without claiming nothing is logged", () => {
    expect(DISCLAIMER_LOG_NOTE).toContain("Hosting providers and browsers");
    expect(DISCLAIMER_LOG_NOTE).toContain("technical access logs");
  });
});
