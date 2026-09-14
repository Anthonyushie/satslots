# Frontend planning scaffolds

This slice builds on the tested read-only integration based on `d0b78c1`. It is not completion of the listing, booking, campaign, delivery, or analytics backend work. No new runtime dependencies, network writes, relay publications, real signatures, invoices, payment simulations, or backend DTOs are introduced.

## Usable surfaces

- **Publishing form:** `PublisherForm` validates existing inputs and produces an explicitly unsaved `ListingPersistence` review. Editing invalidates the review. Publishing stays disabled, listings are not inserted into marketplace inventory, and no browser storage is used. These existing form fields remain in memory while the page stays open, including when its dialog is closed; reload discards them.
- **Placement details:** `BookingForm` collects requested start/end dates and offers a local review. Required dates and end-before-start validation use native form constraints; editing invalidates the review. There is deliberately no availability claim, quote calculation, date-inclusivity assumption, reservation, invoice, or settlement state. `LightningCheckout` names the missing gates and remains disabled. Leaving the placement discards these date inputs.
- **Campaign workspace:** accessible from the footer's **Campaigns**, the publishing form's **Preview campaign tools**, and the placement's **Prepare campaign creative**. `CampaignEditor` supports named creative inputs, HTTP(S) destination validation, a local review, reset, and local image selection. It does not load a campaign list or assign a campaign ID. It is not associated with the currently viewed listing or requested booking dates; the placement UI explicitly discloses this. Saving and activation remain disabled. Closing the workspace discards its state.
- **Artwork:** PNG, JPEG, and WebP files up to 5 MiB can be selected for local preview; SVG and other types are rejected. These are temporary UI limits, not an upload contract. The browser's file MIME/size checks are convenience validation, not a security boundary or decoded-image validation. Files are not uploaded. Object URLs are released on replacement, clear, and unmount. A production upload service must inspect bytes, decode safely, and enforce agreed dimensions, size, MIME, and storage policies.
- **Creative presentation:** `AdCreative` renders escaped text and a local object URL, with no destination link, remote asset request, event tracking, or click handler. It is used for the editor preview and the empty delivery surface. Preview text is labelled **LOCAL PREVIEW · NOT SERVING**. The empty shell clearly says delivery is unavailable, not that a campaign is active.
- **Analytics:** `CampaignAnalytics` exposes an explicit not-connected state, not zeroes, counters, charts, fake spend, or fabricated report rows. Export is disabled.
- **Navigation/design:** existing dialogs, typography, paper/ink/accent variables, and responsive styles are retained. Dialog-to-dialog navigation restores focus to the original page trigger, not an element inside a closed dialog. No new hooks or service abstractions are needed for this local-only state.

## Form types are not API contracts

`src/lib/frontend-forms.ts` names `ListingFormValues`, `BookingFormValues`, and `CampaignFormValues` explicitly as in-memory UI inputs. Dates, price input, and URLs remain strings from forms. These types have no invented database IDs, invoice IDs, campaign lifecycle enum, success responses, session tokens, or server payload shapes. Do not pass them directly to a future API without an agreed mapping and server validation.

## Required agreements with Josh before enabling actions

| Surface               | Missing contract / authoritative behavior                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All writes            | Backend authentication/session proof, ownership/authorization, replay and CSRF protection, error handling, logout/account switching                                               |
| Listing persistence   | Validated fields; CRUD schemas; server ID ↔ Nostr address mapping; DB/relay source of truth and publication order; idempotency and reconciliation                                 |
| Booking               | Listing reference; dates/timezone/inclusivity; availability/concurrency; authoritative quote and expiry; publisher approval; cancellation; idempotency                            |
| Lightning checkout    | Server-side LNbits credentials and wallet ownership; invoice issuance/expiry; status transport; verified settlement; retries and webhook authenticity; cancellation/refund policy |
| Campaigns and artwork | Authenticated campaign ownership; booking linkage; upload limits and byte validation; storage/access policy; approval and activation rules; safe serving assets                   |
| Ad delivery           | Approved creative selection; schedule enforcement; trusted asset and destination handling; cache/expiry behavior; isolation/CSP and allowed framing origins                       |
| Analytics             | Authorized queries; metric definitions, timezone and reporting ranges; deduplication/attribution; privacy/retention; collection and export formats                                |

Existing issue references are context, not enough to implement endpoints. This slice creates no API client, guessed URL, backend request payload, optimistic persistence, or successful-payment path. Loading, retry, and server error states must follow the actual contracts when integrated; they are not simulated here. NIP-07 identity remains distinct from authenticated backend access.

## Static-export deployment blocker

`next.config.ts` still sets `output: "export"`. An arbitrary runtime `/embed/[campaignId]` cannot resolve campaign IDs introduced after the export without a different delivery/deployment strategy. No such route is added. There is no installation snippet, iframe URL, or dynamic fetch disguised as a static route.

The reusable presentation shell is previewed inside the navigable campaign workspace. Before embeddable delivery, choose a runtime host or an agreed static publication/regeneration strategy, establish the delivery contracts above, and enforce approval/schedule checks server-side. A local preview must never become evidence of approved or paid delivery.

## Verification

- `npm ci`: successful, lockfile unchanged; audit reported zero vulnerabilities.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test:nostr`: **70 passed**, unchanged baseline tests.
- `npm run build`: successful static export; only `/` and `/_not-found` generated.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=2`: **28 passed** — all 21 existing browser tests plus 7 planning tests.
- Touched files formatted with Prettier. The unrelated pre-existing README formatting issue is not changed.

The new controlled-browser tests cover local listing review and invalidation, date validation and blocked checkout, navigable campaign editing, escaped text, unsafe destinations, image type/size rejection, actual local image decoding, object URL cleanup, reset/custom validity, empty delivery/analytics, disabled actions, mobile/dark layout, focus restoration, and absence of mutation or remote creative requests. They reuse the existing test-only Nostr signer/relay fixtures and never sign using a real extension or publish to public relays. Browser signing/publishing remains guarded by the fixture; live infrastructure and actual payment settlement have not been tested.

The source ZIP and cumulative patch include the earlier read-only integration and this slice. The patch is against GitHub base `d0b78c1`, not against an intermediate artifact. GitHub is not modified.
