import { createAgentTokenHandler } from "@/components/xlt-agent/openapi/presign.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(message: string, status: number) {
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

/**
 * 浏览器只拿到短期一次性令牌。
 * AK/SK 和示例用户身份仅在服务端读取；正式接入时把 authenticate 换成宿主登录态。
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return json("令牌接口仅允许同源请求", 403);
      }
    } catch {
      return json("非法的 Origin", 403);
    }
  }

  let baseUrl: string;
  let channelId: string;
  let accessKey: string;
  let secretKey: string;
  let externalUserId: string;
  try {
    baseUrl = readEnv("OPENAPI_BASE_URL");
    channelId = readEnv("OPENAPI_CHANNEL_ID");
    accessKey = readEnv("OPENAPI_AK");
    secretKey = readEnv("OPENAPI_SK");
    externalUserId = readEnv("OPENAPI_EXTERNAL_USER_ID");
  } catch (error) {
    console.error(
      "[agent-token] 服务端 OpenAPI 配置不完整：",
      error instanceof Error ? error.message : error,
    );
    return json("服务端尚未配置完整的 OpenAPI 参数", 503);
  }

  const handler = createAgentTokenHandler({
    baseUrl,
    channelId,
    auth: {
      type: "hmac",
      accessKey,
      secretKey,
    },
    // 演示身份由服务端环境确定；生产环境替换为宿主会话中的用户。
    authenticate: async () => ({ id: externalUserId }),
  });

  return handler(request);
}
