import { expect, test } from "@playwright/test";
import { listingEvent, mockRelays } from "./nostr-fixture";

test("a signed-in advertiser can activate a paid campaign and see delivery tools", async ({
  page,
}) => {
  await mockRelays(page, { events: [listingEvent()] });
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { pubkey: "a".repeat(64), username: "advertiser" },
      }),
    }),
  );
  await page.route("**/api/listings?limit=100", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ listings: [] }),
    }),
  );
  await page.route("**/api/campaigns", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          campaigns: [],
          bookings: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              roomTitle: "Independent room",
              startsOn: "2026-09-29",
              endsOn: "2026-10-05",
              campaignId: null,
            },
          ],
        }),
      });
      return;
    }
    const body = route.request().postDataJSON();
    expect(body.status).toBe("active");
    expect(body.imageUrl).toMatch(/^data:image\/png;base64,/);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        campaign: {
          id: "22222222-2222-4222-8222-222222222222",
          bookingId: body.bookingId,
          name: body.name,
          headline: body.headline,
          description: body.description,
          destinationUrl: body.destinationUrl,
          imageUrl: body.imageUrl,
          status: "active",
          impressions: 0,
          clicks: 0,
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Campaigns ↗", exact: true }).click();
  await page.getByLabel("Campaign name", { exact: true }).fill("Launch week");
  await page
    .getByLabel("Creative headline", { exact: true })
    .fill("Read something worth keeping");
  await page
    .getByLabel("Destination URL", { exact: true })
    .fill("https://example.com/read");
  await page.getByLabel("Choose artwork for local preview").setInputFiles({
    name: "creative.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Activate campaign" }).click();
  await expect(
    page.getByText("Campaign activated and ready for its embed."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open publisher demo" }),
  ).toHaveAttribute("href", "/demo/22222222-2222-4222-8222-222222222222");
  await expect(page.getByText("Impressions").locator("..")).toContainText("0");
});
