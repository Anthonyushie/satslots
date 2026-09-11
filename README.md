<img width="150" height="150" alt="favicon" src="https://github.com/user-attachments/assets/50c7de83-6a3f-42d2-a4bc-a24fa4c3c5a5" />
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="9" fill="#f5f3eb"/><path d="M9 13h24v8H17v6h22v8H9z" fill="#dd532a"/><path d="M36 5v10m-5-5h10" stroke="#dd532a" stroke-width="3"/></svg>


# SatSlots

**Your space. Your terms. Your sats.**

A responsive sponsorship-marketplace landing page built with **Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4**. The original editorial design is preserved: warm paper, olive-black ink, burnt-orange accents, custom publication artwork, and local typography.

## Quick start

Requires Node.js **20.19 or newer** (including the Nostr cryptography dependencies). A currently supported Node.js LTS release is recommended.

```sh
npm ci
npm run dev
```

Open the local address printed by Next.js (normally port 3000).

## Production

```sh
npm run build
npm run preview
```

This landing page uses Next.js static export. `next build` prerenders the page into `out/` and bundles the React client interactions. `npm run preview` serves that built directory on port 3000. **Do not use `next start` with this static-export configuration.**

Deploy `out/` at the root of any static host, or deploy the repository to a host that supports Next.js builds. If adding API routes, server actions, or request-time rendering later, remove `output: "export"` from `next.config.ts` and configure a server deployment. For a subdirectory deployment, configure Next.js `basePath` before building.

`build` explicitly uses webpack for predictable compatibility. No development server, CDN, or third-party font request is required to run the production page.

## Project structure

```text
src/
  app/
    layout.tsx                 Metadata, local fonts, global styles
    page.tsx                   Server-rendered page composition
    globals.css                Brand system + build-time Tailwind
    fonts/                     Bundled fonts and OFL license
  components/
    header.tsx                 Mobile navigation and theme control
    hero.tsx                   Original publisher/payment illustration
    principle-strip.tsx
    manifesto.tsx
    faq.tsx                    Native details/summary interaction
    closing.tsx
    footer.tsx
    icon-sprite.tsx             Shared inline SVG symbol definitions
    interactive/
      experience-context.tsx   Typed shared state contract
      experience-provider.tsx  Listings, modals, toast, action buttons
      marketplace.tsx          Filters and sample/local listing cards
      how-it-works.tsx          Advertiser/publisher perspectives
      dialogs.tsx              Listing form and simulated booking
  lib/
    marketplace.ts             Typed sample inventory and helpers
public/
  theme-init.js                System-theme initialization
  assets/                     Favicon and font-license notice
 tests/
  landing.spec.ts              Production browser regression tests
```

Static sections are React Server Components. Interactive sections use client components, typed state, and native dialog refs—not injected HTML or the old vanilla-JavaScript implementation. Fonts are handled by `next/font/local`; Tailwind is compiled through PostCSS.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright suite serves the production export automatically if no preview is already running. It checks hydration and assets, filtering, role switching, booking calculations and boundaries, simulated payment, publisher validation, escaped preview text, preview removal, modal focus restoration, mobile navigation, themes, and overflow at 390, 400, 768, 1024, 1440, and 1920 pixels.

For a system-installed Chromium, optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path. The browser tests use this only as a local test setting; it is not a secret.

## What is—and isn't—live

**Working:** filters, listing details, duration-based prices, a simulated booking journey, publisher/advertiser instructions, local listing creation/removal, themes, FAQs, and mobile navigation.

**Not connected in the UI:** Nostr identity or relay publishing. A standalone P0 service is available in `src/lib/nostr` for NIP-07 connection/signing, profile mapping, listing publication, and validated relay discovery. See the [integration handoff for @wutche](docs/nostr-integration.md) and [listing event contract](docs/nostr-listing-event.md). Run `npm run test:nostr` for isolated service tests. Backend authentication is separate from connecting a Nostr extension.

**Not implemented:** website ownership verification, real availability or reservations, publisher approval, Lightning invoices or settlement, banner delivery, or dispute handling. The page and dialogs label these limitations explicitly. No keys or credentials are required to browse the existing demo; Nostr signing requires a NIP-07 extension, which keeps private keys outside the app.

Publisher form data stays in browser memory and disappears on reload. The website field is checked for an HTTP(S) URL but is not contacted or verified. No analytics, tracking pixels, signup endpoint, wallet, or real payment is connected. React escapes publisher-supplied text.

The sample publications and prices are illustrative—not customer endorsements or real inventory. SatSlots is a concept for BOSS Battle 2026, not an official or endorsed Bitshala product. Track eligibility is not confirmed.

## Before launching the marketplace

Implement and test the missing identity, inventory, payment, and delivery services. Add moderation, advertising disclosures, privacy/legal terms, and clear refund rules. Direct upfront payment is **not escrow**; advertisers accept non-delivery risk. Placement checks cannot guarantee human impressions, clicks, or conversions. Avoid anonymity or censorship-resistance guarantees unsupported by the implementation.

## Typography

DM Sans, Instrument Serif, and IBM Plex Mono are bundled under the SIL Open Font License 1.1. Copyright and license notices are in `src/app/fonts/LICENSE.txt` and `public/assets/font-licenses.css`. Font files are unchanged.

## Preview artifact

The downloadable source is the complete Next.js project, excluding installed dependencies and generated build directories. The separately supplied browser preview is compiled from this project; only its generated asset paths are adjusted for the preview host's relative-path requirements.
# satslots
