"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectNostr,
  getNostrProfile,
  NostrError,
  type NostrConnection,
} from "@/lib/nostr";

/** A local signer identity only; never an authenticated backend session. */
export function useNostrIdentity() {
  const [connection, setConnection] = useState<NostrConnection | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(0);

  useEffect(
    () => () => {
      operation.current += 1;
    },
    [],
  );

  const disconnect = useCallback(() => {
    operation.current += 1;
    setConnection(null);
    setPending(false);
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    const request = ++operation.current;
    setPending(true);
    setError(null);
    try {
      const result = await connectNostr();
      if (request === operation.current) setConnection(result);
    } catch (cause) {
      if (request !== operation.current) return;
      setError(
        cause instanceof NostrError && cause.code === "EXTENSION_UNAVAILABLE"
          ? "Install or enable a NIP-07 Nostr extension, then retry."
          : "Nostr connection was not approved. Please retry in your extension.",
      );
    } finally {
      if (request === operation.current) setPending(false);
    }
  }, []);

  const retryProfile = useCallback(async () => {
    if (!connection) return;
    const request = ++operation.current;
    setPending(true);
    setError(null);
    try {
      const result = await getNostrProfile(connection.pubkey);
      if (request === operation.current) {
        setConnection({
          ...connection,
          profile: result.profile,
          profileStatus: result.status,
          relays: result.relays,
        });
      }
    } catch {
      if (request === operation.current)
        setError(
          "Profile relays are unavailable. Your Nostr identity remains connected.",
        );
    } finally {
      if (request === operation.current) setPending(false);
    }
  }, [connection]);

  return { connection, pending, error, connect, disconnect, retryProfile };
}
