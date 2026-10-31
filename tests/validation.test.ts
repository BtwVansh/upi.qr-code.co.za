import { describe, expect, it } from "vitest";
import {
  classifyInput,
  normalizeIndianMobile,
  parseAmount,
  parseNote,
  validateUpiId,
} from "@/lib/validation";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["91-98765-43210", "9876543210"],
    ["09876543210", "9876543210"],
    ["(98765) 43210", "9876543210"],
    ["  9123456780  ", "9123456780"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    "5876543210",
    "12345",
    "98765432100",
    "+1 9876543210",
    "98765abcde",
    "",
  ])("rejects %s", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe("validateUpiId", () => {
  it.each([
    "merchant@upi",
    "name.surname@okhdfcbank",
    "9876543210@ybl",
    "shop-name@paytm",
    "a_b@oksbi",
    "  Demo@UPI  ",
  ])("accepts %s", (input) => {
    expect(validateUpiId(input).valid).toBe(true);
  });

  it("lowercases the normalized VPA", () => {
    expect(validateUpiId("Demo@UPI").vpa).toBe("demo@upi");
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
});

describe("classifyInput", () => {
  it("classifies Indian mobile numbers", () => {
    const result = classifyInput("+91 98765 43210");
    expect(result.type).toBe("PHONE");
    if (result.type === "PHONE") {
      expect(result.nationalNumber).toBe("9876543210");
      expect(result.normalized).toBe("+919876543210");
    }
  });

  it("classifies UPI IDs", () => {
    const result = classifyInput(" Merchant@UPI ");
    expect(result.type).toBe("UPI");
    if (result.type === "UPI") expect(result.vpa).toBe("merchant@upi");
  });

  it("rejects malformed UPI IDs with a UPI-specific message", () => {
    const result = classifyInput("not-an-id@");
    expect(result.type).toBe("INVALID");
    if (result.type === "INVALID") {
      expect(result.reason).toBe("upi");
      expect(result.message.length).toBeGreaterThan(10);
    }
  });

  it("rejects Indian numbers starting with 1-5", () => {
    const result = classifyInput("5876543210");
    expect(result.type).toBe("INVALID");
    if (result.type === "INVALID") {
      expect(result.message).toContain("start with 6");
    }
  });

  it("rejects empty and unrelated input", () => {
    expect(classifyInput("").type).toBe("INVALID");
    expect(classifyInput("hello there").type).toBe("INVALID");
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
