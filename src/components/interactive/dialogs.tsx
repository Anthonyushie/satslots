"use client";
import { useEffect, useState } from "react";
import { Icon, useExperience } from "./experience-context";
import { NativeDialog, DialogTop } from "./native-dialog";
import { CampaignArea } from "./campaign-area";
import { PublisherForm } from "./publisher-form";
import {
  authErrorMessage,
  signInWithNostr,
} from "@/lib/auth/client";

function AuthDialogContent() {
  const { identity, refreshSession, closeModal, modal } = useExperience();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [profileExists, setProfileExists] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);

  const connection = identity.connection;

  useEffect(() => {
    if (modal?.kind === "auth" && modal.authSubMode) {
      // Ignore authSubMode - we only have Nostr sign-in now
    }
  }, [modal]);

  const checkProfileExists = async (pubkey: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/auth/profile/${pubkey}`, {
        method: "HEAD",
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleNostrSignIn = async () => {
    if (!connection) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithNostr({
        expectedPubkey: connection.pubkey,
        username: username || connection.profile?.name,
      });
      await refreshSession();
      closeModal();
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    setCheckingProfile(true);
    try {
      await identity.connect();
      // Check if profile exists in our database
      if (connection?.pubkey) {
        const exists = await checkProfileExists(connection.pubkey);
        setProfileExists(exists);
        // Auto sign-in if profile exists
        if (exists) {
          await handleNostrSignIn();
          return;
        }
      }
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setLoading(false);
      setCheckingProfile(false);
    }
  };

  if (!connection) {
    return (
      <div id="auth-form" style={{ textAlign: "center" }}>
        {error && (
          <div
            className="project-note"
            role="alert"
            style={{ marginBottom: "1rem" }}
          >
            {error}
          </div>
        )}
        <p className="dialog-lead">
          Connect your Nostr wallet to sign in.
        </p>
        <button
          type="button"
          className="button button-ink w-full"
          onClick={handleConnect}
          disabled={loading}
        >
          {loading ? "Connecting…" : "Connect Nostr Wallet"}
        </button>
      </div>
    );
  }

  if (profileExists && !loading && !checkingProfile) {
    return (
      <div id="auth-form" style={{ textAlign: "center" }}>
        <p className="dialog-lead">
          Welcome back! Signing in…
        </p>
        <button
          type="button"
          className="button button-ink w-full"
          disabled
        >
          Signing in…
        </button>
      </div>
    );
  }

  return (
    <div id="auth-form" style={{ textAlign: "center" }}>
      {error && (
        <div
          className="project-note"
          role="alert"
          style={{ marginBottom: "1rem" }}
        >
          {error}
        </div>
      )}
      <p className="dialog-lead">
        Signing in proves you hold the key for{" "}
        <code>{connection.pubkey.slice(0, 12)}…</code>.
      </p>
      {checkingProfile && (
        <div style={{ marginBottom: "1rem", color: "var(--muted)" }}>
          Checking profile…
        </div>
      )}
      {!profileExists && !checkingProfile && (
        <div style={{ marginBottom: "1rem", textAlign: "left" }}>
          <label htmlFor="auth-username" style={{ display: "block", marginBottom: "0.5rem" }}>
            Username <span style={{ color: "var(--muted)", fontWeight: "normal", fontSize: "0.875rem" }}> (optional)</span>
          </label>
          <input
            id="auth-username"
            name="username"
            className="w-full"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username (auto-generated if empty)"
            maxLength={48}
            autoComplete="username"
          />
        </div>
      )}
      <button
        type="button"
        className="button button-ink w-full"
        onClick={handleNostrSignIn}
        disabled={loading || checkingProfile}
      >
        {loading ? "Waiting for your extension…" : checkingProfile ? "Checking profile…" : "Sign in with Nostr"}
      </button>
    </div>
  );
}

export function DialogLayer() {
  const { modal, closeModal } = useExperience();
  const isLogin = modal?.kind === "auth" && modal.authMode === "login";
  return (
    <>
      <NativeDialog
        id="auth-dialog"
        labelledBy="auth-title"
        active={modal?.kind === "auth"}
      >
        <DialogTop closeLabel="Close account setup">
          {isLogin ? "WELCOME BACK" : "CREATE ACCOUNT"}
        </DialogTop>
        <h2 id="auth-title">{isLogin ? "Sign in" : "Who are you?"}</h2>
        <AuthDialogContent />
      </NativeDialog>
      <NativeDialog
        id="publisher-dialog"
        labelledBy="publisher-title"
        active={modal?.kind === "publisher"}
      >
        <DialogTop closeLabel="Close listing form">
          YOUR CORNER OF THE INTERNET
        </DialogTop>
        <h2 id="publisher-title">
          Make a little <em>room.</em>
        </h2>
        <p className="dialog-lead">
          Describe your corner of the internet. Publishing saves the room to your
          account and announces it to the relays, so advertisers can find it.
        </p>
        <PublisherForm />
      </NativeDialog>
      <NativeDialog
        id="campaigns-dialog"
        labelledBy="campaigns-title"
        active={modal?.kind === "campaigns"}
      >
        <DialogTop closeLabel="Close campaign workspace">
          PLAN SOMETHING GOOD
        </DialogTop>
        {modal?.kind === "campaigns" && <CampaignArea />}
      </NativeDialog>
      <NativeDialog
        id="about-dialog"
        labelledBy="about-title"
        active={modal?.kind === "about"}
      >
        <DialogTop closeLabel="Close project notes">
          THE SMALL PRINT, IN NORMAL SIZE
        </DialogTop>
        <h2 id="about-title">
          A starting <em>point.</em>
        </h2>
        <p className="dialog-lead">
          SatSlots is a proposed open-source sponsorship marketplace for the
          BOSS Battle 2026 Freedom Stack track. It is not an official Bitshala
          product or an endorsed entry.
        </p>
        <div className="project-note">
          <h3>What works here</h3>
          <p>
            Nostr identity connection, public profile lookup, relay marketplace
            discovery, placement filters, listing details, and server-side
            sign-in with your Nostr key.
          </p>
          <h3>What still needs building</h3>
          <p>
            Database-backed publishing, website ownership checks, publisher
            approval, Lightning invoice settlement, banner delivery, and dispute
            handling.
          </p>
          <h3>Privacy and relay access</h3>
          <p>
            Public relay queries expose your IP address to relay operators. No
            analytics or advertising trackers are included. Form inputs stay in
            memory and disappear on reload. Fonts and styles are bundled
            locally.
          </p>
        </div>
        <button
          type="button"
          className="button button-ink w-full"
          data-close-dialog=""
          onClick={closeModal}
        >
          Back to the good stuff <Icon name="arrow-right" />
        </button>
      </NativeDialog>
    </>
  );
}
