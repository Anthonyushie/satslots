"use client";
import { useEffect, useState } from "react";
import { useExperience } from "@/components/interactive/experience-provider";
import { DialogLayer } from "@/components/interactive/dialogs";

export function LoginClient() {
  const { user, openModal, modal } = useExperience();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      window.location.href = "/dashboard";
      return;
    }
    if (modal?.kind !== "auth") {
      openModal({ kind: "auth", authMode: "login", authSubMode: "email" }, undefined);
    }
  }, [ready, user, modal, openModal]);

  if (!ready) return null;

  return (
    <main className="site-shell" style={{ padding: "96px 24px" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
          Sign in to SatSlots
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
          Use your email and password, or sign in with your Nostr key.
        </p>
        <button
          type="button"
          className="text-link feature-action"
          onClick={() => openModal({ kind: "auth", authMode: "login", authSubMode: "email" })}
        >
          Open sign-in
        </button>
      </div>
      <DialogLayer />
    </main>
  );
}
