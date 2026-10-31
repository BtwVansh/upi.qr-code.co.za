import { describe, expect, it } from "vitest";
import {
  blindIndex,
  decryptPii,
  encryptJson,
  encryptPii,
  hashIp,
  tryDecryptJson,
  tryDecryptPii,
} from "@/lib/crypto";

describe("PII encryption", () => {
  it("round-trips strings with AES-256-GCM", () => {
    const ciphertext = encryptPii("demo@upi");
    expect(ciphertext).not.toBeNull();
    expect(ciphertext).not.toContain("demo@upi");
    expect(decryptPii(ciphertext)).toBe("demo@upi");
  });

  it("uses a random IV for every encryption", () => {
    const first = encryptPii("9876543210");
    const second = encryptPii("9876543210");
    expect(first).not.toBe(second);
    expect(decryptPii(first)).toBe("9876543210");
    expect(decryptPii(second)).toBe("9876543210");
  });

  it("passes null through", () => {
    expect(encryptPii(null)).toBeNull();
    expect(decryptPii(null)).toBeNull();
    expect(encryptJson(undefined)).toBeNull();
  });

  it("rejects tampered ciphertext", () => {
    const ciphertext = encryptPii("tamper me") as string;
    const parts = ciphertext.split(".");
    const bytes = Buffer.from(parts[3], "base64url");
    bytes[0] = bytes[0] ^ 0xff;
    parts[3] = bytes.toString("base64url");
    expect(() => decryptPii(parts.join("."))).toThrow();
    expect(tryDecryptPii(parts.join("."))).toBeNull();
  });

  it("round-trips JSON", () => {
    const payload = encryptJson({ verified: true, code: "MOCK_OK" });
    expect(tryDecryptJson(payload)).toEqual({
      verified: true,
      code: "MOCK_OK",
    });
  });
});

describe("blind indexes", () => {
  it("is deterministic and case/space insensitive", () => {
    expect(blindIndex(" Demo@UPI ")).toBe(blindIndex("demo@upi"));
  });

  it("separates contexts", () => {
    expect(blindIndex("demo@upi", "upi")).not.toBe(
      blindIndex("demo@upi", "input"),
    );
  });

  it("hashes IPs without retaining the raw address", () => {
    const hash = hashIp("203.0.113.42");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("203.0.113");
  });
});
