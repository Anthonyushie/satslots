import { expect, test, type Page } from "@playwright/test";
import { listingEvent, mockRelays, mockExtension } from "./nostr-fixture";

async function preparePage(page: Page) {
  const relay = await mockRelays(page, { events: [listingEvent()] });
  await mockExtension(page);
  const unexpectedRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" ||
      (!request.url().startsWith("http://127.0.0.1:3000/") &&
        !request.url().startsWith("blob:"))
    ) {
      unexpectedRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.goto("/");
  await expect(page.locator(".listing-card")).toHaveCount(1);
  return { relay, unexpectedRequests };
}

async function fillCreative(page: Page) {
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Independent launch");
  await page
    .getByLabel("Creative headline", { exact: true })
    .fill("Hello <script> & friends");
  await page
    .getByLabel("Destination URL", { exact: true })
    .fill("https://example.com/sponsor");
}

test("listing review is local, escaped, invalidated on edit, and never persisted", async ({
  page,
}) => {
  const { relay, unexpectedRequests } = await preparePage(page);
  await page.locator(".nav-cta").click();
  await page.getByRole("button", { name: "Review listing locally" }).click();
  await expect(
    page.getByRole("heading", { name: "Unsaved listing review" }),
  ).toHaveCount(0);
  await page.getByLabel("Publication name").fill("Local <script> publisher");
  await page
    .getByLabel("Website URL", { exact: true })
    .fill("https://example.com");
  await page.getByLabel("Who is it for?").fill("Independent readers");
  await page.getByRole("button", { name: "Review listing locally" }).click();
  await expect(
    page.getByRole("region", { name: "Listing review and persistence" }),
  ).toContainText("Local <script> publisher");
  await expect(page.locator("#publisher-form script")).toHaveCount(0);
  await page.getByLabel("Publication name").fill("Changed publication");
  await expect(
    page.getByRole("heading", { name: "Unsaved listing review" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Publishing unavailable" }),
  ).toBeDisabled();
  await page.reload();
  await page.locator(".nav-cta").click();
  await expect(page.getByLabel("Publication name")).toHaveValue("");
  expect(relay.publications).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
});

test("booking dates validate locally and checkout never produces an invoice", async ({
  page,
}) => {
  const { relay, unexpectedRequests } = await preparePage(page);
  const trigger = page.locator("[data-placement]");
  await trigger.click();
  await page.getByLabel("Requested start date").fill("2027-05-10");
  await page.getByLabel("Requested end date").fill("2027-05-09");
  await page.getByRole("button", { name: "Review requested dates" }).click();
  await expect(
    page.getByText("Requested dates:", { exact: false }),
  ).toHaveCount(0);
  await page.getByLabel("Requested end date").fill("2027-05-12");
  await page.getByRole("button", { name: "Review requested dates" }).click();
  await expect(
    page.getByText("Requested dates:", { exact: false }),
  ).toContainText("Not reserved or saved");
  await expect(
    page.getByRole("button", { name: "Booking unavailable" }),
  ).toBeDisabled();
  await expect(
    page.getByText("No invoice is available.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Requested start date").fill("2027-05-11");
  await expect(
    page.getByText("Requested dates:", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Prepare campaign creative" }).click();
  await expect(page.locator("#campaigns-dialog")).toBeVisible();
  await expect(page.locator("#placement-dialog")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel("Requested start date")).toHaveValue("");
  expect(relay.publications).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
});

test("campaign workspace offers local editing but no saved records or live metrics", async ({
  page,
}) => {
  const { relay, unexpectedRequests } = await preparePage(page);
  const trigger = page.getByRole("button", {
    name: "Campaigns ↗",
    exact: true,
  });
  await trigger.click();
  await fillCreative(page);
  await page
    .getByLabel("Creative description", { exact: true })
    .fill("A small independent launch.");
  await page.getByRole("button", { name: "Review creative locally" }).click();
  await expect(
    page.getByText("Local review ready", { exact: false }),
  ).toContainText("Not saved, uploaded, approved, or activated");
  await expect(page.locator(".ad-creative").first()).toContainText(
    "Hello <script> & friends",
  );
  await expect(page.locator(".ad-creative script, .ad-creative a")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Activation unavailable" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Campaign saving unavailable" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Embed installation unavailable" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Report export unavailable" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Analytics not connected.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Ad delivery unavailable.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel("Campaign name", { exact: true })).toHaveValue(
    "",
  );
  expect(relay.publications).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
});

test("creative preview accepts local images, rejects unsafe types, and revokes object URLs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const revoked: string[] = [];
    (window as unknown as { revokedPreviewUrls: string[] }).revokedPreviewUrls =
      revoked;
    const original = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
      original(url);
    };
  });
  const { relay, unexpectedRequests } = await preparePage(page);
  await page.getByRole("button", { name: "Campaigns ↗", exact: true }).click();
  const input = page.getByLabel("Choose artwork for local preview");
  await input.setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg />"),
  });
  await expect(page.locator("#artwork-error")).toContainText(
    "Choose a PNG, JPEG, or WebP",
  );
  await input.setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.locator("#artwork-error")).toContainText(
    "no larger than 5 MiB",
  );
  const image = {
    name: "preview.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  await input.setInputFiles(image);
  const preview = page.getByAltText("Selected creative artwork");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveJSProperty("naturalWidth", 1);
  const imageUrl = await preview.getAttribute("src");
  expect(imageUrl).toMatch(/^blob:/);
  await page.getByRole("button", { name: "Clear creative" }).click();
  await expect(preview).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { revokedPreviewUrls: string[] })
            .revokedPreviewUrls,
      ),
    )
    .toContain(imageUrl);
  await input.setInputFiles(image);
  const secondUrl = await preview.getAttribute("src");
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { revokedPreviewUrls: string[] })
            .revokedPreviewUrls,
      ),
    )
    .toContain(secondUrl);
  expect(relay.publications).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
});

test("unsafe destinations are invalid and clearing resets custom validity", async ({
  page,
}) => {
  const { unexpectedRequests } = await preparePage(page);
  await page.getByRole("button", { name: "Campaigns ↗", exact: true }).click();
  await fillCreative(page);
  await page
    .getByLabel("Destination URL", { exact: true })
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Review creative locally" }).click();
  await expect(
    page.getByText("Local review ready", { exact: false }),
  ).toHaveCount(0);
  expect(
    await page
      .getByLabel("Destination URL", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.customError),
  ).toBe(true);
  await page.getByRole("button", { name: "Clear creative" }).click();
  expect(
    await page
      .getByLabel("Destination URL", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.customError),
  ).toBe(false);
  await fillCreative(page);
  await page.getByRole("button", { name: "Review creative locally" }).click();
  await expect(
    page.getByText("Local review ready", { exact: false }),
  ).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
});

for (const width of [390, 1280]) {
  test(`campaign and publisher navigation preserve layout and focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await preparePage(page);
    if (width === 1280)
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
    const trigger = page.locator("[data-list-space]").last();
    await trigger.click();
    await page.getByRole("button", { name: "Preview campaign tools" }).click();
    await expect(page.locator("#campaigns-dialog")).toBeVisible();
    await fillCreative(page);
    await page
      .getByLabel("Creative description", { exact: true })
      .fill("Long".repeat(40));
    expect(
      await page
        .locator("#campaigns-dialog")
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`campaign-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveClass(/dialog-open/);
  });
}
