import { describe, expect, it } from "vitest";
import {
  MAX_UPI_ID_LENGTH,
  parseAmount,
  parseNote,
  validateUpiId,
} from "@/lib/validation";

describe("validateUpiId", () => {
  it.each([
    "merchant@upi",
    "name.surname@okhdfcbank",
    "9876543210@ybl",
    "shop-name@paytm",
    "a_b@oksbi",
    "  Demo@UPI  ",
    "ABCD@UPI",
  ])("accepts %s", (input) => {
    expect(validateUpiId(input).valid).toBe(true);
  });

  it("preserves the entered casing in the VPA", () => {
    expect(validateUpiId("ABCD@UPI").vpa).toBe("ABCD@UPI");
    expect(validateUpiId("  Demo@OKAXIS  ").vpa).toBe("Demo@OKAXIS");
  });

  it.each([
    "merchant",
    "merchant@",
    "@upi",
    "a@upi",
    "merchant@@upi",
    "mer chant@upi",
    ".merchant@upi",
    "merchant.@upi",
    "merchant@1bank",
    "merchant@u",
    "merchant@up i",
  ])("rejects %s", (input) => {
    expect(validateUpiId(input).valid).toBe(false);
  });

  it("rejects empty and over-long input", () => {
    expect(validateUpiId("").valid).toBe(false);
    expect(validateUpiId(`${"a".repeat(MAX_UPI_ID_LENGTH)}@upi`).valid).toBe(
      false,
    );
  });
});

describe("parseAmount", () => {
  it("accepts and canonicalizes valid amounts", () => {
    expect(parseAmount("100").value).toBe("100.00");
    expect(parseAmount("99.5").value).toBe("99.50");
    expect(parseAmount("0.01").value).toBe("0.01");
    expect(parseAmount("100000").value).toBe("100000.00");
  });

  it("treats empty as no amount", () => {
    expect(parseAmount("").value).toBeNull();
    expect(parseAmount(undefined).value).toBeNull();
  });

  it.each(["0", "-1", "1.234", "abc", "100001", "1,000"])(
    "rejects %s",
    (input) => {
      expect(parseAmount(input).error).toBeTruthy();
    },
  );
});

describe("parseNote", () => {
  it("normalizes whitespace and controls", () => {
    expect(parseNote("  Dinner   with\u0000 Amit  ").value).toBe(
      "Dinner with Amit",
    );
  });

  it("enforces the 50 character limit", () => {
    expect(parseNote("a".repeat(51)).error).toBeTruthy();
  });

  it("treats empty as no note", () => {
    expect(parseNote("   ").value).toBeNull();
  });
});
