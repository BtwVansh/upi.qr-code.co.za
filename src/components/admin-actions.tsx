"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderIcon, LogoutIcon } from "@/components/icons";

export function AdminActions({ retentionDays }: { retentionDays: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"logout" | "retention" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function logout() {
    setBusy("logout");
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function runRetention() {
    const confirmed = window.confirm(
      `Delete all payment requests older than ${retentionDays} days? This cannot be undone.`,
    );
    if (!confirmed) return;

    setBusy("retention");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/retention", { method: "POST" });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; deleted?: number; error?: { message?: string } }
        | null;
      if (!response.ok || !data?.ok) {
        setMessage(data?.error?.message ?? "Retention run failed.");
        return;
      }
      setMessage(`Deleted ${data.deleted ?? 0} expired request(s).`);
      router.refresh();
    } catch {
      setMessage("Couldn't reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void runRetention()}
          disabled={busy !== null}
          className="btn-secondary !px-4 !py-2.5 text-[12px]"
        >
          {busy === "retention" && <LoaderIcon className="h-3.5 w-3.5" />}
          Run retention
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={busy !== null}
          className="btn-ghost !px-3 !py-2.5 text-[12px]"
        >
          {busy === "logout" ? (
            <LoaderIcon className="h-3.5 w-3.5" />
          ) : (
            <LogoutIcon className="h-3.5 w-3.5" />
          )}
          Sign out
        </button>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] text-muted"
        >
          {message}
        </p>
      )}
    </div>
  );
}
