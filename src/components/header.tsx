"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ListSpaceButton } from "@/components/interactive/experience-provider";

function currentTheme() {
  return document.documentElement.classList.contains("dark");
}
function subscribeTheme(onChange: () => void) {
  const preference = window.matchMedia("(prefers-color-scheme: dark)");
  const syncPreference = () => {
    if (document.documentElement.dataset.theme !== "manual") {
      document.documentElement.classList.toggle("dark", preference.matches);
      onChange();
    }
  };
  syncPreference();
  preference.addEventListener("change", syncPreference);
  window.addEventListener("satslots-theme-change", onChange);
  return () => {
    preference.removeEventListener("change", syncPreference);
    window.removeEventListener("satslots-theme-change", onChange);
  };
}
const serverTheme = () => false;

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const dark = useSyncExternalStore(subscribeTheme, currentTheme, serverTheme);

  useEffect(() => {
    const wideScreen = window.matchMedia("(min-width: 1024px)");
    const closeWideMenu = () => {
      if (wideScreen.matches) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    wideScreen.addEventListener("change", closeWideMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      wideScreen.removeEventListener("change", closeWideMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = "manual";
    root.classList.toggle("dark");
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.content = root.classList.contains("dark") ? "#191e19" : "#f5f3eb";
      });
    window.dispatchEvent(new Event("satslots-theme-change"));
  }

  return (
    <header className="site-header">
      <div className="site-shell nav-row flex items-center justify-between gap-4">
        <a
          className="brand flex items-center gap-2"
          href="#"
          aria-label="SatSlots home"
        >
          <svg className="brand-mark" aria-hidden="true">
            <use href="#mark" />
          </svg>
          <span>
            satslots<span className="brand-period">.</span>
          </span>
        </a>
        <nav
          className="desktop-nav hidden md:flex items-center gap-8"
          aria-label="Main navigation"
        >
          <a href="#spaces">The marketplace</a>
          <a href="#how-it-works">How it works</a>
          <a href="#why-satslots">Why SatSlots</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="theme-toggle icon-button"
            id="theme-toggle"
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleTheme}
          >
            <svg className="icon" aria-hidden="true">
              <use href="#sun" />
            </svg>
          </button>
          <ListSpaceButton className="nav-cta hidden sm:flex items-center gap-3">
            List your space{" "}
            <svg className="icon icon-small" aria-hidden="true">
              <use href="#arrow-up" />
            </svg>
          </ListSpaceButton>
          <button
            type="button"
            className="mobile-menu-button icon-button md:hidden"
            id="menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        className="mobile-nav site-shell"
        aria-label="Mobile navigation"
        hidden={!menuOpen}
      >
        <a href="#spaces" onClick={() => setMenuOpen(false)}>
          The marketplace <span>01</span>
        </a>
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
          How it works <span>02</span>
        </a>
        <a href="#why-satslots" onClick={() => setMenuOpen(false)}>
          Why SatSlots <span>03</span>
        </a>
        <ListSpaceButton onClick={() => setMenuOpen(false)}>
          List your space{" "}
          <svg className="icon" aria-hidden="true">
            <use href="#arrow-up" />
          </svg>
        </ListSpaceButton>
      </nav>
    </header>
  );
}
