import { describe, expect, it } from "vitest";
import { parsePaymentRoute } from "@/lib/payment-route";
import { stripBasePath, withBasePath } from "@/lib/site";

describe("GitHub Pages base path", () => {
  it("prefixes app paths", () => {
    expect(withBasePath("/")).toBe("/upi-gen/");
    expect(withBasePath("/pay/ABCD%40OKAXIS")).toBe(
      "/upi-gen/pay/ABCD%40OKAXIS",
    );
    expect(withBasePath("/#how-it-works")).toBe("/upi-gen/#how-it-works");
  });

  it("strips the base path from browser paths", () => {
    expect(stripBasePath("/upi-gen")).toBe("/");
    expect(stripBasePath("/upi-gen/")).toBe("/");
    expect(stripBasePath("/upi-gen/pay/ABCD%40OKAXIS")).toBe(
      "/pay/ABCD%40OKAXIS",
    );
    expect(stripBasePath("/pay/ABCD%40OKAXIS")).toBe("/pay/ABCD%40OKAXIS");
  });
});

describe("parsePaymentRoute", () => {
  it("reconstructs a UPI ID from an encoded payment URL", () => {
    expect(parsePaymentRoute("/upi-gen/pay/ABCD%40OKAXIS")).toEqual({
      upiId: "ABCD@OKAXIS",
      amount: null,
      note: null,
    });
  });

  it("accepts a raw @ and a trailing slash", () => {
    expect(parsePaymentRoute("/upi-gen/pay/ABCD@OKAXIS/")).toEqual({
      upiId: "ABCD@OKAXIS",
      amount: null,
      note: null,
    });
  });

  it("reads optional amount and note from the query string", () => {
    expect(
      parsePaymentRoute(
        "/upi-gen/pay/ABCD%40OKAXIS",
        "?amount=125.50&note=Dinner%20%26%20tea",
      ),
    ).toEqual({
      upiId: "ABCD@OKAXIS",
      amount: "125.50",
      note: "Dinner & tea",
    });
  });

  it("ignores invalid optional values", () => {
    expect(
      parsePaymentRoute("/upi-gen/pay/ABCD%40OKAXIS", "?amount=0&note="),
    ).toEqual({
      upiId: "ABCD@OKAXIS",
      amount: null,
      note: null,
    });
  });

  it("rejects paths that are not payment links", () => {
    expect(parsePaymentRoute("/upi-gen/")).toBeNull();
    expect(parsePaymentRoute("/upi-gen/pay/")).toBeNull();
    expect(parsePaymentRoute("/upi-gen/pay/not-a-upi")).toBeNull();
    expect(parsePaymentRoute("/upi-gen/about")).toBeNull();
  });

  it("rejects a double-encoded UPI ID", () => {
    expect(parsePaymentRoute("/upi-gen/pay/ABCD%2540OKAXIS")).toBeNull();
  });
});
