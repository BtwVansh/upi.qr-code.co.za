import { randomBytes } from "node:crypto";

const REQUEST_ID_PATTERN = /^pr_[A-Za-z0-9_-]{22}$/;

/** 128 bits of randomness, URL-safe, prefixed for easy identification. */
export function createRequestId(): string {
  return `pr_${randomBytes(16).toString("base64url")}`;
}

export function isRequestId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value);
}
