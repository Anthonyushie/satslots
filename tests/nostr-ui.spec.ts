import { expect, test } from "@playwright/test";
import {
  listingEvent,
  mockExtension,
  mockRelays,
  profileEvent,
} from "./nostr-fixture";

test("loading, empty, offline, retry and partial relay warnings are distinct", async ({
  page,
}) => {
  const relay = await mockRelays(page, { delayMs: 300 });
  await page.goto("/");
  await expect(page.getByText("Loading Nostr listings…")).toBeVisible();
  await expect(
    page.getByText("No listings found on the configured relays."),
  ).toBeVisible();
  await expect(page.locator(".listing-card")).toHaveCount(0);
  relay.options.offline = true;
  await page.getByRole("button", { name: "Refresh listings" }).click();
  await expect(
    page.locator(".marketplace-status").getByRole("alert"),
  ).toContainText("Unable to load listings");
  relay.options.offline = false;
  relay.options.partial = true;
  relay.options.events = [listingEvent()];
  await page.getByRole("button", { name: "Retry listings" }).click();
  await expect(page.locator(".listing-card")).toHaveCount(1);
  await expect(
    page.getByText("Some relays are unavailable. Results may be incomplete."),
  ).toBeVisible();
  expect(relay.publications).toEqual([]);
});

test("revisions use the stable Nostr address and escape relay content", async ({
  page,
}) => {
  const original = listingEvent();
  const relay = await mockRelays(page, { events: [original] });
  await page.goto("/");
  const card = page.locator(".listing-card");
  await expect(card).toHaveCount(1);
  const address = await card.getAttribute("data-listing-id");
  expect(address).not.toBe(original.id);
  await card.evaluate((element) =>
    element.setAttribute("data-retained", "yes"),
  );
  relay.options.events = [
    original,
    listingEvent("Updated <script> publication", 200),
  ];
  await page.getByRole("button", { name: "Refresh listings" }).click();
  await expect(card.locator("h3")).toContainText(
    "Updated <script> publication",
  );
  await expect(card).toHaveAttribute("data-retained", "yes");
  await expect(card).toHaveAttribute("data-listing-id", address!);
  await expect(card.locator("script")).toHaveCount(0);
  await card.locator("button").click();
  await expect(page.locator("#placement-title")).toHaveText(
    "Updated <script> publication",
  );
});

test("extension absence shows actionable retry guidance", async ({ page }) => {
  await mockRelays(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect Nostr", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect with extension" }).click();
  await expect(
    page.locator("#nostr-account-panel").getByRole("alert"),
  ).toContainText("Install or enable a NIP-07");
  await expect(
    page.getByRole("button", { name: "Retry Nostr connection" }),
  ).toBeEnabled();
});

test("extension rejection is recoverable without claiming authentication", async ({
  page,
}) => {
  await mockRelays(page);
  await mockExtension(page, "deny");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect Nostr", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect with extension" }).click();
  await expect(
    page.locator("#nostr-account-panel").getByRole("alert"),
  ).toContainText("not approved");
  await expect(
    page.getByRole("button", { name: "Disconnect", exact: true }),
  ).toHaveCount(0);
});

test("profile outage retains signer, retries metadata, then disconnects", async ({
  page,
}) => {
  const relay = await mockRelays(page, { profileOffline: true });
  await mockExtension(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect Nostr", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect with extension" }).click();
  await expect(
    page.getByText("Profile relays unavailable; identity is still connected."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Nostr identity connected. No authenticated backend session.",
    ),
  ).toBeVisible();
  relay.options.profileOffline = false;
  relay.options.profile = profileEvent;
  await page.getByRole("button", { name: "Retry profile" }).click();
  await expect(
    page.getByRole("button", { name: "Test publisher", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Public test profile")).toBeVisible();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Connect Nostr", exact: true }),
  ).toBeVisible();
  expect(relay.publications).toEqual([]);
});

test("missing profile keeps identity connected and disclosure supports Escape", async ({
  page,
}) => {
  await mockRelays(page);
  await mockExtension(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect Nostr", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect with extension" }).click();
  await expect(page.getByText("No public profile found.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#nostr-account-panel")).not.toBeVisible();
  await expect(
    page.locator('[aria-controls="nostr-account-panel"]'),
  ).toBeFocused();
});

test("cancelled connection ignores late extension completion", async ({
  page,
}) => {
  await mockRelays(page, { profile: profileEvent });
  await mockExtension(page, "defer");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect Nostr", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect with extension" }).click();
  await page.getByRole("button", { name: "Cancel connection" }).click();
  await page.evaluate(() =>
    (
      window as unknown as { resolveNostrConnection: () => void }
    ).resolveNostrConnection(),
  );
  // Wait for the late profile query to finish without permitting it to reconnect.
  await page.waitForTimeout(300);
  await expect(
    page.getByRole("button", { name: "Connect Nostr", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Disconnect", exact: true }),
  ).toHaveCount(0);
});

test("long profile names and the open account panel fit mobile screens", async ({
  page,
}) => {
  const { finalizeEvent } = await import("nostr-tools/pure");
  const longProfile = finalizeEvent(
    {
      kind: 0,
      created_at: 200,
      tags: [],
      content: JSON.stringify({ name: "A".repeat(120) }),
    },
    new Uint8Array(32).fill(7),
  );
  await mockRelays(page, { profile: longProfile });
  await mockExtension(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect Nostr", exact: true })
    .click();
  await page.getByRole("button", { name: "Connect with extension" }).click();
  await expect(
    page.getByRole("button", { name: "A".repeat(120), exact: true }),
  ).toBeVisible();
  for (const width of [390, 400, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const bounds = await page.locator("#nostr-account-panel").boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
});
