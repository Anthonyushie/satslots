import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hero-title")).toBeVisible();
});

test("hydrates without React errors or failed assets", async ({ page }) => {
  const errors: string[] = [];
  const failures: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failures.push(request.url()));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".listing-card")).toHaveCount(3);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  expect(await page.title()).toContain("SatSlots");
});

test("filters placements and switches publisher instructions", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.locator(".listing-card:visible")).toHaveCount(1);
  await expect(page.locator(".listing-card:visible h3")).toContainText(
    "Offscript",
  );
  await page.locator('[data-filter="all"]').click();
  await expect(page.locator(".listing-card:visible")).toHaveCount(3);
  await page.getByRole("button", { name: "I’m a publisher" }).click();
  await expect(page.locator("#steps")).toContainText(
    "Make room for a good fit.",
  );
  await page.getByRole("button", { name: "I’m an advertiser" }).click();
  await expect(page.locator("#steps")).toContainText(
    "Find your kind of people.",
  );
});

test("calculates a booking and completes only a simulated payment", async ({
  page,
}) => {
  const trigger = page.locator('[data-placement="fieldnotes"]');
  await trigger.click();
  await page.locator("#booking-days").fill("3");
  await expect(page.locator("#booking-summary")).toContainText("15,000 sats");
  await page.getByRole("button", { name: "Preview booking request" }).click();
  await expect(page.locator("#placement-title")).toContainText(
    "A little human",
  );
  await page
    .getByRole("button", { name: "Simulate publisher approval" })
    .click();
  await expect(page.locator("#placement-content")).toContainText(
    "No invoice is generated",
  );
  await page
    .getByRole("button", { name: "Simulate payment", exact: true })
    .click();
  await expect(page.locator("#placement-content")).toContainText(
    "NO MONEY MOVED",
  );
  await page.getByRole("button", { name: "Explore another space" }).click();
  await expect(page.locator("#placement-dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveClass(/dialog-open/);
});

test("rejects booking durations outside 1–30 days", async ({ page }) => {
  await page.locator('[data-placement="offscript"]').click();
  for (const days of ["0", "31", "1.5", ""]) {
    await page.locator("#booking-days").fill(days);
    await page.getByRole("button", { name: "Preview booking request" }).click();
    await expect(page.locator("#booking-days")).toBeVisible();
    expect(
      await page
        .locator("#booking-days")
        .evaluate((el: HTMLInputElement) => el.validity.valid),
    ).toBeFalsy();
  }
});

test("creates and removes an escaped local listing preview", async ({
  page,
}) => {
  await page.locator(".nav-cta").click();
  await page.locator("#site-name").fill("Indie <script> & Open");
  await page.locator("#site-url").fill("https://example.com");
  await page.locator("#site-category").selectOption("Development");
  await page.locator("#site-price").fill("2500");
  await page
    .locator("#site-description")
    .fill("A publication for independent makers & open-source builders.");
  await page.getByRole("button", { name: "Create my listing preview" }).click();
  await expect(page.locator(".listing-card")).toHaveCount(4);
  const card = page.locator(".listing-card").first();
  await expect(card.locator("h3")).toContainText("Indie <script> & Open");
  await expect(card.locator("script")).toHaveCount(0);
  await card.locator("[data-placement]").click();
  await page.getByRole("button", { name: "Remove this local preview" }).click();
  await expect(page.locator(".listing-card")).toHaveCount(3);
});

test("validates publisher input without making external requests", async ({
  page,
}) => {
  await page.locator(".nav-cta").click();
  await page.locator("#site-name").fill("My publication");
  await page.locator("#site-url").fill("ftp://example.com");
  await page
    .locator("#site-description")
    .fill("A small audience of independent creators.");
  await page.getByRole("button", { name: "Create my listing preview" }).click();
  await expect(page.locator("#publisher-dialog")).toBeVisible();
  await page.locator("#site-url").fill("https://example.com");
  await page.locator("#site-name").fill("   ");
  await page.getByRole("button", { name: "Create my listing preview" }).click();
  await expect(page.locator("#publisher-dialog")).toBeVisible();
  await expect(page.locator(".listing-card")).toHaveCount(3);
});

test("Escape closes dialogs and FAQ keeps one answer open", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Project notes" }).click();
  await expect(page.locator("#about-dialog")).toContainText(
    "Nostr identity and relay publishing",
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
  await page.locator('[data-placement="quietbuild"]').click();
  expect(
    await page.locator("#placement-dialog").evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    }),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
});
