import { expect, test } from "@playwright/test";
import { listingEvent, mockRelays } from "./nostr-fixture";

test.beforeEach(async ({ page }) => {
  await mockRelays(page, { events: [listingEvent()] });
  await page.goto("/");
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(page.locator(".listing-card")).toHaveCount(1);
});

test("hydrates without React errors or failed assets", async ({ page }) => {
  const errors: string[] = [];
  const failures: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failures.push(request.url()));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".listing-card")).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  expect(await page.title()).toContain("SatSlots");
});

test("filters relay placements and switches publisher instructions", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Bitcoin", exact: true }).click();
  await expect(page.locator(".listing-card:visible")).toHaveCount(0);
  await expect(
    page.getByText("No listings match this category."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.locator(".listing-card:visible")).toHaveCount(1);
  await page.getByRole("button", { name: "I’m a publisher" }).click();
  await expect(page.locator("#steps")).toContainText(
    "Make room for a good fit.",
  );
  await page.getByRole("button", { name: "I’m an advertiser" }).click();
  await expect(page.locator("#steps")).toContainText(
    "Find your kind of people.",
  );
});

test("booking is explicitly blocked and native dialog restores focus", async ({
  page,
}) => {
  const trigger = page.locator("[data-placement]");
  await trigger.click();
  await expect(page.locator("#placement-content")).toContainText("3,000 sats");
  await expect(
    page.getByRole("button", { name: "Booking unavailable" }),
  ).toBeDisabled();
  await expect(page.locator("#booking-unavailable")).toContainText(
    "No booking is created",
  );
  await expect(page.getByRole("button", { name: /Simulate/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#placement-dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveClass(/dialog-open/);
});

test("publisher form never inserts local inventory or sends a mutation", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") mutations.push(request.url());
  });
  const trigger = page.locator(".nav-cta");
  await trigger.click();
  await page.locator("#site-name").fill("Indie <script> & Open");
  await page.locator("#site-url").fill("https://example.com");
  await page.locator("#site-description").fill("Independent creators.");
  await expect(
    page.getByRole("button", { name: "Publishing unavailable" }),
  ).toBeDisabled();
  await page
    .locator("#publisher-form")
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator("#publisher-dialog")).toBeVisible();
  await expect(page.locator(".listing-card")).toHaveCount(1);
  expect(mutations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("Escape closes dialogs and FAQ keeps one answer open", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Project notes" }).click();
  await expect(page.locator("#about-dialog")).toContainText(
    "Authenticated backend sessions",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#about-dialog")).not.toBeVisible();
  await page.getByText("Why bitcoin? Why sats?", { exact: true }).click();
  await expect(page.locator(".faq-list details[open]")).toHaveCount(1);
});

test("respects system color preference and manual theme switch", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

for (const width of [390, 400, 768, 1024, 1440, 1920]) {
  test(`fits the ${width}px viewport without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
}

test("mobile navigation and dialog remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#mobile-nav")).toBeVisible();
  await page.locator('#mobile-nav a[href="#spaces"]').click();
  await expect(page.locator("#mobile-nav")).not.toBeVisible();
  await page.locator("[data-placement]").click();
  expect(
    await page.locator("#placement-dialog").evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    }),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
});
