import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const AAD = Buffer.from("upi-pay-qr:pii:v1", "utf8");
const keyCache = new Map<string, Buffer>();

function readKey(envName: "APP_ENCRYPTION_KEY" | "APP_INDEX_KEY"): Buffer {
  const cached = keyCache.get(envName);
  if (cached) return cached;

  const raw = (process.env[envName] ?? "").trim();
  if (!raw) {
    throw new Error(`${envName} is not configured.`);
  }

  let key: Buffer;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    const fromBase64 = Buffer.from(raw, "base64");
    if (fromBase64.length !== 32) {
      throw new Error(
        `${envName} must be 32 bytes encoded as 64 hex characters or base64.`,
      );
    }
    key = fromBase64;
  }

  keyCache.set(envName, key);
  return key;
}

/**
 * AES-256-GCM with a random 96-bit IV and authenticated encryption.
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url components).
 */
export function encryptPii(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  const key = readKey("APP_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptPii(payload: string | null | undefined): string | null {
  if (payload === null || payload === undefined) return null;
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw new Error("Unsupported ciphertext format.");
  }

  const [, ivRaw, tagRaw, ciphertextRaw] = parts;
  const iv = Buffer.from(ivRaw, "base64url");
  const tag = Buffer.from(tagRaw, "base64url");
  const ciphertext = Buffer.from(ciphertextRaw, "base64url");
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid ciphertext.");
  }

  const decipher = createDecipheriv("aes-256-gcm", readKey("APP_ENCRYPTION_KEY"), iv, {
    authTagLength: 16,
  });
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/** Returns null instead of throwing when decryption fails (e.g. rotated keys). */
export function tryDecryptPii(
  payload: string | null | undefined,
): string | null {
  try {
    return decryptPii(payload);
  } catch {
    return null;
  }
}

/**
 * Keyed index for equality lookups. Uses a separate key from encryption so a
 * leaked index key cannot decrypt rows, and the same plaintext is not directly
 * guessable without the key.
 */
export function blindIndex(
  value: string | null | undefined,
  context = "general",
): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim().toLowerCase();
  return createHmac("sha256", readKey("APP_INDEX_KEY"))
    .update(context)
    .update("\0")
    .update(normalized)
    .digest("hex");
}

export function hashIp(ip: string | null | undefined): string | null {
  return blindIndex(ip ?? null, "ip");
}

export function encryptJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return encryptPii(JSON.stringify(value));
}

export function tryDecryptJson<T = unknown>(payload: string | null): T | null {
  const plain = tryDecryptPii(payload);
  if (!plain) return null;
  try {
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}

/** Constant-time comparison for passwords and tokens of arbitrary length. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}
