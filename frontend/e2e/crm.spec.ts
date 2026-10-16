import { expect, test } from "@playwright/test";

test("contact to won deal, persistence, deletion protection, and cleanup", async ({
  page,
}) => {
  await page.goto("/#contacts");
  await page
    .getByRole("button", { name: "Add contact", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("Browser Test Contact");
  await page.getByLabel("Email address").fill("browser@example.com");
  await page.getByLabel("Company", { exact: true }).fill("Browser Test Co");
  await page.getByRole("button", { name: "Create contact" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("browser@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Edit Browser Test Contact" }).click();
  await page.getByLabel("Notes").fill("Remember to follow up.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Pipeline", exact: true }).click();
  await page.getByRole("button", { name: "Add deal", exact: true }).click();
  await page.getByLabel("Deal title").fill("Browser Test Opportunity");
  await page
    .getByRole("combobox", { name: /^Contact/ })
    .selectOption({ label: "Browser Test Contact · Browser Test Co" });
  await page.getByLabel("Value (INR)").fill("42000.50");
  await page.getByLabel("Expected close").fill("2030-12-15");
  await page.getByRole("button", { name: "Create deal", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("Stage for Browser Test Opportunity")
    .selectOption("won");
  await expect(
    page
      .getByRole("region", { name: "Won deals", exact: true })
      .getByRole("button", { name: "Browser Test Opportunity", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Won deals", exact: true })
      .getByRole("button", { name: "Browser Test Opportunity", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByText("₹42,000.50", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Browser Test Contact" })
    .click();
  await page
    .getByRole("button", { name: "Delete contact", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("has deals");
  await page.getByRole("button", { name: "Keep contact" }).click();
  await page.getByRole("link", { name: "Pipeline", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Browser Test Opportunity" })
    .click();
  await page.getByRole("button", { name: "Delete deal", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Browser Test Contact" })
    .click();
  await page
    .getByRole("button", { name: "Delete contact", exact: true })
    .click();
  await expect(page.getByText("browser@example.com")).toHaveCount(0);
});

test("mobile navigation and dialog keyboard dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your people, in one place." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add contact", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
