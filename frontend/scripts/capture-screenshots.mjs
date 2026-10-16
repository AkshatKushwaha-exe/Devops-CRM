// Capture desktop and mobile evidence screenshots of a running CRM.
// Usage: node scripts/capture-screenshots.mjs <base-url> <output-dir>
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const [
  baseURL = "http://127.0.0.1:3000",
  outDir = "../docs/evidence/screenshots",
] = process.argv.slice(2);
const views = ["overview", "contacts", "pipeline", "activity"];
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [device, viewport] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    for (const view of views) {
      await page.goto(`${baseURL}/#${view}`);
      await page.waitForLoadState("networkidle");
      // Lists debounce their first fetch, so wait until no loading placeholder remains.
      await page.waitForTimeout(500);
      await page.waitForFunction(
        () => !document.body.innerText.includes("Loading your workspace"),
      );
      await page.screenshot({
        path: `${outDir}/${device}-${view}.png`,
        fullPage: true,
      });
    }
    if (device === "mobile") {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.waitForTimeout(600); // let the drawer finish sliding in
      await page.screenshot({ path: `${outDir}/mobile-navigation.png` });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Saved screenshots for ${baseURL} to ${outDir}`);
