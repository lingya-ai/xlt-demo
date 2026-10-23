import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const appUrl = process.env.APP_URL ?? "http://127.0.0.1:4612";
const executablePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const prompt = process.env.TEST_PROMPT ?? "你好，请用一句话介绍你自己。";

await mkdir("artifacts", { recursive: true });
const step = (message) => console.log(`[step] ${message}`);

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: "zh-CN",
});
const page = await context.newPage();

const consoleErrors = [];
const failedResponses = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) =>
  consoleErrors.push(`pageerror: ${error.message}`),
);
page.on("response", (response) => {
  if (response.status() >= 400) {
    failedResponses.push(`${response.status()} ${response.url()}`);
  }
});

const result = {
  appUrl,
  prompt,
  conversationIdInUrl: false,
  assistantText: "",
  messageCountBeforeReload: 0,
  messageCountAfterReload: 0,
  historyRestored: false,
  consoleErrors,
  failedResponses,
};

async function snap(name) {
  await page
    .screenshot({ path: `artifacts/${name}.png`, timeout: 15_000 })
    .catch((error) => console.log(`[warn] screenshot ${name}: ${error.message}`));
}

try {
  step("打开页面");
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  const input = page.locator("textarea").first();
  await input.waitFor({ state: "visible", timeout: 60_000 });
  await snap("chat-before");

  step("发送测试消息");
  await input.fill(prompt);
  await input.press("Enter");

  step("等待用户与助手消息出现");
  await page.waitForFunction(
    () => document.querySelectorAll("[data-message-id]").length >= 2,
    undefined,
    { timeout: 120_000 },
  );

  step("等待流式输出稳定");
  let last = "";
  let stable = 0;
  for (let i = 0; i < 90; i += 1) {
    await page.waitForTimeout(1_000);
    const text = (await page.locator("[data-message-id]").allInnerTexts()).join("\n");
    if (text && text === last) stable += 1;
    else {
      stable = 0;
      last = text;
    }
    if (stable >= 3) break;
  }

  const messages = await page.locator("[data-message-id]").allInnerTexts();
  result.messageCountBeforeReload = messages.length;
  result.assistantText = messages.slice(1).join("\n").trim().slice(0, 4000);
  result.conversationIdInUrl = /[?&]conversation=/.test(page.url());
  await snap("chat-response");
  console.log(JSON.stringify(result, null, 2));

  if (!result.assistantText) throw new Error("助手消息为空，未获得真实回复");
  if (!result.conversationIdInUrl) throw new Error("会话 ID 未写入 URL");

  step("刷新并检查历史恢复");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-message-id]").length >= 2,
    undefined,
    { timeout: 60_000 },
  );
  result.messageCountAfterReload = await page
    .locator("[data-message-id]")
    .count();
  const restored = await page.locator("[data-message-id]").allInnerTexts();
  result.historyRestored = restored.join("\n").includes(
    result.assistantText.slice(0, 20),
  );
  await snap("chat-history");
  console.log(JSON.stringify(result, null, 2));

  if (!result.historyRestored) throw new Error("刷新后历史消息未恢复");
  if (consoleErrors.length) throw new Error("浏览器控制台存在错误");
} catch (error) {
  await snap("chat-failure");
  console.log(JSON.stringify(result, null, 2));
  console.error("VERIFY FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
