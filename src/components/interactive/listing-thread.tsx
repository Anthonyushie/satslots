"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useExperience } from "./experience-context";

/**
 * The comment fields this component renders.
 *
 * Declared here rather than imported from src/lib/api/serialize.ts, which is
 * marked `server-only` — importing a type from it would be erased at compile time
 * but is a trap for the next person who reaches for a value from the same module.
 * A Comment from the API satisfies this structurally.
 */
export interface ThreadComment {
  id: string;
  authorPubkey: string;
  authorUsername: string;
  body: string;
  createdAt: string;
}

function when(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

export function ListingThread({
  listingId,
  comments,
  publisherPubkey,
}: {
  listingId: string;
  comments: readonly ThreadComment[];
  publisherPubkey: string;
}) {
  const { user, openModal } = useExperience();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const viewerPubkey = user?.pubkey ?? null;

  async function post(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      openModal({ kind: "auth", authMode: "login" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/listings/${listingId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: unknown;
        };
        setError(
          typeof payload.error === "string"
            ? payload.error
            : "The comment could not be posted.",
        );
        return;
      }
      setBody("");
      // The page is a server component, so re-render it from the database rather
      // than keeping a second copy of the thread in client state.
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/listings/${listingId}/comments?commentId=${commentId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError("That comment could not be removed.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="feature-section" aria-labelledby="thread-heading">
      <h2 id="thread-heading">Questions and answers</h2>

      {comments.length === 0 ? (
        <p className="marketplace-status">
          No questions yet. Ask the publisher anything you want to know before
          booking.
        </p>
      ) : (
        <ul className="dashboard-list">
          {comments.map((comment) => {
            // Mirrors the listing_comments_delete policy: your own words, or
            // anything said on a room you own.
            const canRemove =
              comment.authorPubkey === viewerPubkey ||
              viewerPubkey === publisherPubkey;
            return (
              <li key={comment.id} className="dashboard-card">
                <h3>
                  {comment.authorUsername}
                  {comment.authorPubkey === publisherPubkey && (
                    <span className="mono"> · publisher</span>
                  )}
                </h3>
                <p className="mono muted">{when(comment.createdAt)}</p>
                <p>{comment.body}</p>
                {canRemove && (
                  <button
                    type="button"
                    className="text-link"
                    disabled={busy}
                    onClick={() => void remove(comment.id)}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form aria-label="Post a comment" onSubmit={post}>
        <label htmlFor="thread-body">Add to the thread</label>
        <textarea
          className="w-full"
          id="thread-body"
          name="body"
          rows={3}
          maxLength={2000}
          required
          value={body}
          placeholder={
            user
              ? "Ask about the audience, the placement, or a date range."
              : "Sign in to join the thread."
          }
          onChange={(event) => setBody(event.target.value)}
        />
        <button
          type="submit"
          className="text-link feature-action"
          disabled={busy || !body.trim()}
        >
          {busy ? "Posting…" : user ? "Post comment" : "Sign in to comment"}
        </button>
      </form>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
