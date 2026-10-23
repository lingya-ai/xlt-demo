import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const appUrl = process.env.APP_URL ?? "http://127.0.0.1:4612";
const executablePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const prompt =
  "请写一篇大约 800 字的短文，主题是秋天，分段输出，不要使用列表。";

await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "zh-CN",
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) =>
  consoleErrors.push(`pageerror: ${error.message}`),
);

const result = {
  stopButtonObserved: false,
  stopClicked: false,
  textAtStop: 0,
  textAfterStop: 0,
  stopped: false,
  consoleErrors,
};

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  const input = page.locator("textarea").first();
  await input.waitFor({ state: "visible", timeout: 60_000 });
  await input.fill(prompt);
  await input.press("Enter");

  const stopButton = page.locator('button[aria-label="停止生成"]');
  await stopButton
    .first()
    .waitFor({ state: "visible", timeout: 45_000 })
    .then(() => {
      result.stopButtonObserved = true;
    })
    .catch(() => {});

  if (result.stopButtonObserved) {
    result.textAtStop = (
      await page.locator("[data-message-id]").allInnerTexts()
    ).join("\n").length;
    await stopButton.first().click();
    result.stopClicked = true;
    await stopButton
      .first()
      .waitFor({ state: "hidden", timeout: 30_000 })
      .catch(() => {});
    await page.waitForTimeout(3_000);
    result.textAfterStop = (
      await page.locator("[data-message-id]").allInnerTexts()
    ).join("\n").length;
    result.stopped = result.textAfterStop - result.textAtStop < 200;
  }

  await page.screenshot({ path: "artifacts/chat-stop.png" });
  console.log(JSON.stringify(result, null, 2));
  if (!result.stopClicked) process.exitCode = 2;
  else if (!result.stopped) process.exitCode = 1;
} catch (error) {
  await page.screenshot({ path: "artifacts/chat-stop.png" }).catch(() => {});
  console.log(JSON.stringify(result, null, 2));
  console.error("STOP VERIFY FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
