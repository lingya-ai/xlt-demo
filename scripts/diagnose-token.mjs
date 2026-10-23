import { readFile } from "node:fs/promises";
import { AgentsClient } from "@lingya-ai/agents-sdk";
const text = await readFile(".env.local", "utf8");
for (const line of text.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && m[2]) process.env[m[1]] ??= m[2]; }
const client = new AgentsClient({ baseUrl: process.env.OPENAPI_BASE_URL, channelId: process.env.OPENAPI_CHANNEL_ID, auth: { type: "hmac", accessKey: process.env.OPENAPI_AK, secretKey: process.env.OPENAPI_SK, externalUserId: process.env.OPENAPI_EXTERNAL_USER_ID } });
for (let i=1;i<=12;i++) {
  try { const t = await client.configuration.createOpenApiToken({ timeoutMs: 15000 }); console.log(`${new Date().toISOString()} attempt ${i}: OK tokenLength=${t.token?.length}`); process.exit(0); }
  catch (e) { const body = String(e?.responseBody ?? e?.message).replace(/\s+/g," "); console.log(`${new Date().toISOString()} attempt ${i}: status=${e?.status} ${body.includes("GATEWAY_SERVICE_UNAVAILABLE") ? "GATEWAY_SERVICE_UNAVAILABLE" : body.slice(0,120)}`); }
  if (i<12) await new Promise(r=>setTimeout(r,15000));
}
process.exit(2);
