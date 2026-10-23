import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const appUrl = process.env.APP_URL ?? "http://127.0.0.1:4612";
const executablePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const fileName = "upload-check.txt";

await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
const failedRequests = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) =>
  consoleErrors.push(`pageerror: ${error.message}`),
);
page.on("requestfailed", (request) => {
  failedRequests.push(
    `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
  );
});

const result = {
  presignStatus: 0,
  presignSupport: false,
  uploadMethod: "",
  presignMaximumBytes: null,
  confirmStatus: 0,
  fileVisible: false,
  consoleErrors,
  failedRequests,
};

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.locator("textarea").first().waitFor({ state: "visible", timeout: 60_000 });

  const presignResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/files/pre-signed-url/write") &&
      response.request().method() === "POST",
    { timeout: 60_000 },
  );
  const confirmResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/files/pre-signed-url/confirm") &&
      response.request().method() === "POST",
    { timeout: 90_000 },
  );

  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from("XLT attachment upload check\n"),
  });

  const presign = await presignResponse;
  result.presignStatus = presign.status();
  if (presign.status() < 400) {
    const body = await presign.json();
    result.presignSupport = Boolean(body.support);
    result.uploadMethod = body.uploadMethod ?? "";
    result.presignMaximumBytes = body.maximumBytes ?? null;
  } else {
    const body = await presign.text();
    throw new Error(`presign failed ${presign.status()}: ${body.slice(0, 300)}`);
  }

  const confirm = await confirmResponse;
  result.confirmStatus = confirm.status();
  if (confirm.status() >= 400) {
    const body = await confirm.text();
    throw new Error(`confirm failed ${confirm.status()}: ${body.slice(0, 300)}`);
  }

  await page
    .getByText(new RegExp(fileName.replace(".", "\\.")))
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  result.fileVisible = true;
  await page.screenshot({ path: "artifacts/chat-upload.png" });

  console.log(JSON.stringify(result, null, 2));
  if (!result.presignSupport || !result.fileVisible) {
    throw new Error("upload did not complete");
  }
} catch (error) {
  await page
    .screenshot({ path: "artifacts/chat-upload-failure.png" })
    .catch(() => {});
  console.log(JSON.stringify(result, null, 2));
  console.error("UPLOAD VERIFY FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
