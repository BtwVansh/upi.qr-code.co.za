"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderIcon, LockIcon } from "@/components/icons";

export function AdminLoginForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || disabled) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;

      if (!response.ok || !data?.ok) {
        setError(data?.error?.message ?? "Sign-in failed. Please try again.");
        return;
      }

      setPassword("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6">
      <label htmlFor="admin-password" className="label">
        Admin password
      </label>
      <div className="relative">
        <LockIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter password"
          autoComplete="current-password"
          className="field !pl-10"
          disabled={disabled || loading}
          autoFocus
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2.5 text-[12px] font-medium text-[color:var(--danger)]"
        >
          {error}
        </p>
      )}

      {disabled && (
        <p className="mt-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-[11.5px] leading-relaxed text-muted">
          Admin access is disabled. Set a strong <code>ADMIN_PASSWORD</code>{" "}
          (12+ characters) and <code>ADMIN_SESSION_SECRET</code> (32+
          characters) to enable it.
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || loading || !password}
        className="btn-primary mt-4 w-full"
      >
        {loading ? (
          <>
            <LoaderIcon className="h-4 w-4" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
