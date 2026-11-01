import { describe, expect, it } from "vitest";
import {
  buildAndroidAppIntent,
  buildAppLaunchUrl,
  buildPaymentPagePath,
  buildPaymentPageUrl,
  buildUpiUri,
  decodeUpiIdSegment,
  detectPlatform,
} from "@/lib/upi";

describe("buildUpiUri", () => {
  it("builds a fully encoded standard UPI payment URI", () => {
    const uri = buildUpiUri({ payeeVpa: "ABCD@UPI" });
    expect(uri).toBe("upi://pay?pa=ABCD%40UPI&cu=INR");
    expect(uri).toContain("%40");
    expect(uri).not.toContain("@");
  });

  it("includes amount and note with percent-encoded spaces", () => {
    const uri = buildUpiUri({
      payeeVpa: "merchant@upi",
      amount: "99.5",
      note: "Dinner with Amit",
    });
    expect(uri).toBe(
      "upi://pay?pa=merchant%40upi&am=99.50&cu=INR&tn=Dinner%20with%20Amit",
    );
    expect(uri).not.toContain("+");
  });

  it("omits optional fields when empty", () => {
    const uri = buildUpiUri({
      payeeVpa: "merchant@upi",
      amount: "",
      note: "",
    });
    expect(uri).toBe("upi://pay?pa=merchant%40upi&cu=INR");
  });

  it("encodes parentheses and other reserved characters in notes", () => {
    const uri = buildUpiUri({
      payeeVpa: "merchant@upi",
      note: "Coffee (filter)",
    });
    expect(uri).toContain("Coffee%20%28filter%29");
  });

  it("rejects invalid UPI IDs and amounts", () => {
    expect(() => buildUpiUri({ payeeVpa: "invalid" })).toThrow();
    expect(() => buildUpiUri({ payeeVpa: "merchant@upi", amount: "0" })).toThrow();
    expect(() =>
      buildUpiUri({ payeeVpa: "merchant@upi", amount: "1.234" }),
    ).toThrow();
  });
});

describe("permanent payment page URLs", () => {
  it("encodes the UPI ID in the path and preserves its casing", () => {
    expect(buildPaymentPagePath("ABCD@UPI")).toBe("/pay/ABCD%40UPI");
  });

  it("adds optional amount and note as query parameters", () => {
    const path = buildPaymentPagePath("merchant@upi", {
      amount: "250",
      note: "Rent",
    });
    const url = new URL(path, "https://pay.example");
    expect(url.pathname).toBe("/pay/merchant%40upi");
    expect(url.searchParams.get("amount")).toBe("250.00");
    expect(url.searchParams.get("note")).toBe("Rent");
  });

  it("builds an absolute shareable URL under the GitHub Pages base path", () => {
    expect(
      buildPaymentPageUrl("https://pay.example", "merchant@upi", {
        amount: "49",
      }),
    ).toBe("https://pay.example/upi-gen/pay/merchant%40upi?amount=49.00");
  });

  it("omits invalid optional values", () => {
    expect(
      buildPaymentPagePath("merchant@upi", { amount: "-5", note: "" }),
    ).toBe("/pay/merchant%40upi");
  });
});

describe("decodeUpiIdSegment", () => {
  it("decodes an encoded UPI ID", () => {
    expect(decodeUpiIdSegment("abcd%40upi")).toBe("abcd@upi");
  });

  it("accepts an already-decoded UPI ID", () => {
    expect(decodeUpiIdSegment("abcd@upi")).toBe("abcd@upi");
  });

  it("preserves case", () => {
    expect(decodeUpiIdSegment("ABCD%40UPI")).toBe("ABCD@UPI");
  });

  it("rejects malformed route segments", () => {
    expect(decodeUpiIdSegment("not-a-upi")).toBeNull();
    expect(decodeUpiIdSegment("%E0%A4%A")).toBeNull();
  });
});

describe("app launch links", () => {
  const upiUri = "upi://pay?pa=merchant%40upi&cu=INR";

  it("targets a specific Android package", () => {
    const intent = buildAndroidAppIntent(
      upiUri,
      "com.google.android.apps.nbu.paisa.user",
      "https://example.com/pay/merchant%40upi",
    );
    expect(intent.startsWith("intent://pay?pa=merchant%40upi")).toBe(true);
    expect(intent).toContain("scheme=upi");
    expect(intent).toContain(
      "package=com.google.android.apps.nbu.paisa.user",
    );
    expect(intent).toContain("action=android.intent.action.VIEW");
    expect(intent).toContain("category=android.intent.category.BROWSABLE");
    expect(intent).toContain(
      "S.browser_fallback_url=https%3A%2F%2Fexample.com%2Fpay%2Fmerchant%2540upi",
    );
    expect(intent.endsWith(";end")).toBe(true);
  });

  it("uses the correct package for PhonePe and Paytm", () => {
    expect(buildAppLaunchUrl("phonepe", upiUri, "android")).toContain(
      "package=com.phonepe.app",
    );
    expect(buildAppLaunchUrl("paytm", upiUri, "android")).toContain(
      "package=net.one97.paytm",
    );
    expect(buildAppLaunchUrl("gpay", upiUri, "android")).toContain(
      "package=com.google.android.apps.nbu.paisa.user",
    );
  });

  it("uses app-specific iOS schemes", () => {
    expect(buildAppLaunchUrl("gpay", upiUri, "ios")).toBe(
      "gpay://upi/pay?pa=merchant%40upi&cu=INR",
    );
    expect(buildAppLaunchUrl("phonepe", upiUri, "ios")).toBe(
      "phonepe://pay?pa=merchant%40upi&cu=INR",
    );
    expect(buildAppLaunchUrl("paytm", upiUri, "ios")).toBe(
      "paytmmp://pay?pa=merchant%40upi&cu=INR",
    );
  });

  it("does not launch an app on desktop", () => {
    expect(buildAppLaunchUrl("gpay", upiUri, "desktop")).toBeNull();
  });

  it("rejects non-UPI schemes", () => {
    expect(() =>
      buildAndroidAppIntent("https://example.com", "com.phonepe.app"),
    ).toThrow();
  });
});

describe("detectPlatform", () => {
  it.each([
    ["Mozilla/5.0 (Linux; Android 14)", "android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "ios"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", "ios"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "desktop"],
  ] as const)("detects %s", (ua, expected) => {
    expect(detectPlatform(ua)).toBe(expected);
  });
});
