"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Role = "advertiser" | "publisher";

/**
 * The status moves offered on a booking, given who is looking at it and where the
 * booking currently stands.
 *
 * This mirrors the ALLOWED table in src/app/api/bookings/[id]/route.ts. The server
 * is the authority; this only decides which buttons are worth showing.
 */
function availableMoves(status: string, role: Role): string[] {
  if (status === "pending") {
    return role === "publisher" ? ["approved", "rejected"] : ["cancelled"];
  }
  if (status === "approved") return ["completed", "cancelled"];
  return [];
}

const LABELS: Record<string, string> = {
  approved: "Approve",
  rejected: "Reject",
  cancelled: "Cancel",
  completed: "Mark completed",
};

export function BookingActions({
  id,
  role,
  status,
}: {
  id: string;
  role: Role;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const moves = availableMoves(status, role);
  if (moves.length === 0) return null;

  async function move(next: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: unknown;
        };
        setError(
          typeof body.error === "string"
            ? body.error
            : "That change was not allowed.",
        );
        return;
      }
      // The page is a server component, so re-render it from the database rather
      // than trying to keep a client copy in step.
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="booking-actions">
      {moves.map((next) => (
        <button
          key={next}
          type="button"
          className="text-link feature-action"
          disabled={busy}
          onClick={() => void move(next)}
        >
          {busy ? "Working…" : LABELS[next]}
        </button>
      ))}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
