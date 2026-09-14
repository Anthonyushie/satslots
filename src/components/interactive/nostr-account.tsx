"use client";

import { useEffect, useRef, useState } from "react";
import { useExperience } from "./experience-context";

export function NostrAccount() {
  const { identity } = useExperience();
  const { connection, pending, error, connect, disconnect, retryProfile } =
    identity;
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setExpanded(false);
      trigger.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [expanded]);

  return (
    <div
      className="nostr-account"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setExpanded(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="text-link"
        aria-expanded={expanded}
        aria-controls="nostr-account-panel"
        onClick={() => setExpanded((current) => !current)}
      >
        {connection ? connection.profile.name : "Connect Nostr"}
      </button>
      <div
        id="nostr-account-panel"
        className="nostr-account-panel"
        hidden={!expanded}
      >
        {connection ? (
          <>
            <p>
              <strong>{connection.profile.name}</strong>
            </p>
            <p className="mono">
              {connection.pubkey.slice(0, 12)}…{connection.pubkey.slice(-8)}
            </p>
            {connection.profile.bio && <p>{connection.profile.bio}</p>}
            <p role="status">
              Nostr identity connected. No authenticated backend session.
            </p>
            {connection.profileStatus !== "found" && (
              <p>
                {connection.profileStatus === "missing"
                  ? "No public profile found."
                  : "Profile relays unavailable; identity is still connected."}
              </p>
            )}
            <button
              type="button"
              className="text-link"
              disabled={pending}
              onClick={() => void retryProfile()}
            >
              {pending ? "Loading profile…" : "Retry profile"}
            </button>
            <button type="button" className="text-link" onClick={disconnect}>
              Disconnect
            </button>
            <p>
              Disconnect clears this page’s identity. Extension permissions are
              managed in your extension.
            </p>
          </>
        ) : (
          <>
            <p>
              Connect your Nostr identity with a NIP-07 browser extension. This
              does not sign you into a backend account.
            </p>
            <button
              type="button"
              className="button button-ink"
              disabled={pending}
              onClick={() => void connect()}
            >
              {pending
                ? "Connecting…"
                : error
                  ? "Retry Nostr connection"
                  : "Connect with extension"}
            </button>
            {pending && (
              <button type="button" className="text-link" onClick={disconnect}>
                Cancel connection
              </button>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
