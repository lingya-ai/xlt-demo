import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.APP_URL ?? "http://127.0.0.1:4612";
const executablePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

await mkdir("artifacts", { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 820 },
  locale: "zh-CN",
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: "artifacts/ui-smoke.png", fullPage: true });
console.log("title:", await page.title());
console.log("body:", (await page.locator("body").innerText()).slice(0, 1200));
console.log("consoleErrors:", JSON.stringify(consoleErrors, null, 2));

await browser.close();
