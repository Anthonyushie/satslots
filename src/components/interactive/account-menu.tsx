"use client";

import { useEffect, useRef, useState } from "react";
import { useExperience } from "./experience-context";

/**
 * The signed-in account control.
 *
 * Replaces the plain username text and bare Logout link that used to sit in the
 * header. Behaviour mirrors NostrAccount: the trigger reports its state with
 * aria-expanded, Escape closes and returns focus to it, and losing focus to
 * anything outside the menu closes it.
 */
export function AccountMenu() {
  const { user, logout } = useExperience();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  // Fetch profile data when menu opens
  useEffect(() => {
    if (!open || !user) return;
    
    async function fetchProfile() {
      try {
        const response = await fetch("/api/auth/profile");
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    }
    
    fetchProfile();
  }, [open, user]);

  if (!user) return null;

  return (
    <div
      className="account-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        // Deliberately not .nav-cta. That class must keep matching exactly one
        // element on the page: the browser tests locate it with
        // page.locator(".nav-cta"), and a second match fails them in strict mode.
        // The styling is shared through the grouped rule in globals.css instead.
        className="nav-account-menu hidden sm:flex items-center gap-2"
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-menu-name">{user.username}</span>
        <svg className="icon icon-small" aria-hidden="true">
          <use href="#arrow-up" />
        </svg>
      </button>
      <div id="account-menu-panel" className="account-menu-panel" hidden={!open}>
        <div className="account-menu-profile">
          <p className="account-menu-username">{profile?.username || user.username}</p>
          {profile?.lightning_address && (
            <p className="account-menu-lightning">
              <span className="mono">{profile.lightning_address}</span>
            </p>
          )}
          {profile?.bio && (
            <p className="account-menu-bio">{profile.bio}</p>
          )}
        </div>
        <a
          className="account-menu-item"
          href="/dashboard"
          onClick={() => setOpen(false)}
        >
          Dashboard
        </a>
        <a
          className="account-menu-item"
          href="/profile"
          onClick={() => setOpen(false)}
        >
          Edit Profile
        </a>
        <button
          type="button"
          className="account-menu-item"
          onClick={() => {
            setOpen(false);
            void logout();
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
