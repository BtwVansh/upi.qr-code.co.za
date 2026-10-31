import { describe, expect, it } from "vitest";
import {
  buildAndroidUpiIntent,
  buildPaymentPageLink,
  buildUpiUri,
} from "@/lib/upi";

describe("buildUpiUri", () => {
  it("builds a standard UPI payment URI", () => {
    const uri = buildUpiUri({
      payeeVpa: "Demo@UPI",
      payeeName: "Demo User",
    });
    expect(uri).toBe("upi://pay?pa=demo@upi&pn=Demo%20User&cu=INR");
  });

  it("includes amount and note in the documented order", () => {
    const uri = buildUpiUri({
      payeeVpa: "merchant@upi",
      payeeName: "Demo Merchant",
      amount: "99.5",
      note: "Dinner with Amit",
    });
    expect(uri).toBe(
      "upi://pay?pa=merchant@upi&pn=Demo%20Merchant&am=99.50&cu=INR&tn=Dinner%20with%20Amit",
    );
    expect(uri).not.toContain("+");
  });

  it("omits optional fields when empty", () => {
    const uri = buildUpiUri({
      payeeVpa: "merchant@upi",
      payeeName: "   ",
      amount: "",
      note: "",
    });
    expect(uri).toBe("upi://pay?pa=merchant@upi&cu=INR");
  });

  it("rejects invalid UPI IDs and amounts", () => {
    expect(() => buildUpiUri({ payeeVpa: "invalid" })).toThrow();
    expect(() =>
      buildUpiUri({ payeeVpa: "merchant@upi", amount: "0" }),
    ).toThrow();
    expect(() =>
      buildUpiUri({ payeeVpa: "merchant@upi", amount: "1.234" }),
    ).toThrow();
  });
});

describe("buildAndroidUpiIntent", () => {
  it("opens a chooser without hardcoding a package", () => {
    const intent = buildAndroidUpiIntent(
      "upi://pay?pa=merchant@upi&pn=Demo%20Merchant&cu=INR",
      "https://example.com/pay/pr_123",
    );
    expect(intent.startsWith("intent://pay?pa=merchant@upi")).toBe(true);
    expect(intent).toContain("scheme=upi");
    expect(intent).toContain("action=android.intent.action.VIEW");
    expect(intent).toContain("category=android.intent.category.BROWSABLE");
    expect(intent).not.toContain("package=");
    expect(intent).toContain("S.browser_fallback_url=https%3A%2F%2Fexample.com");
    expect(intent.endsWith(";end")).toBe(true);
  });

  it("rejects non-UPI schemes", () => {
    expect(() => buildAndroidUpiIntent("https://example.com")).toThrow();
  });
});

describe("buildPaymentPageLink", () => {
  it("builds a shareable link with amount and note", () => {
    const link = buildPaymentPageLink("https://pay.example", "pr_abc", {
      amount: "250",
      note: "Rent",
    });
    const url = new URL(link);
    expect(url.pathname).toBe("/pay/pr_abc");
    expect(url.searchParams.get("amount")).toBe("250.00");
    expect(url.searchParams.get("note")).toBe("Rent");
  });

  it("omits invalid optional values", () => {
    const link = buildPaymentPageLink("https://pay.example", "pr_abc", {
      amount: "-5",
      note: "",
    });
    expect(link).toBe("https://pay.example/pay/pr_abc");
  });
});
