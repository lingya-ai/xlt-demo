import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "cookie",
  "host",
  "keep-alive",
  "origin",
  "proxy-authenticate",
  "proxy-authorization",
  "referer",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const FORWARDED_RESPONSE_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-type",
  "etag",
  "last-modified",
  "retry-after",
  "x-request-id",
  "x-openapi-request-id",
];

function json(message: string, status: number) {
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * 同源代理：只放行当前渠道的聊天 API 路径。
 * SSE 响应直接透传 ReadableStream，不缓冲、不解析业务事件。
 */
async function proxy(request: NextRequest) {
  const baseUrl = process.env.OPENAPI_BASE_URL?.trim();
  const channelId = process.env.OPENAPI_CHANNEL_ID?.trim();
  if (!baseUrl || !channelId) {
    return json("服务端尚未配置 OpenAPI 网关或渠道", 503);
  }

  const requestUrl = new URL(request.url);
  const prefix = "/api/agent";
  if (!requestUrl.pathname.startsWith(`${prefix}/`)) {
    return json("未知代理路径", 404);
  }

  const suffix = requestUrl.pathname.slice(prefix.length);
  const segments = suffix.split("/").filter(Boolean);

  // /api/agents/channel/openapi/v1/{channelId}/...
  if (
    segments.length < 7 ||
    segments[0] !== "api" ||
    segments[1] !== "agents" ||
    segments[2] !== "channel" ||
    segments[3] !== "openapi" ||
    segments[4] !== "v1"
  ) {
    return json("只允许当前渠道的聊天 API 路径", 403);
  }

  let requestedChannel: string;
  try {
    requestedChannel = decodeURIComponent(segments[5] ?? "");
  } catch {
    return json("渠道路径编码非法", 400);
  }
  if (requestedChannel !== channelId) {
    return json("渠道不匹配", 403);
  }

  const upstreamUrl = new URL(
    `${baseUrl.replace(/\/+$/, "")}${suffix}${requestUrl.search}`,
  );
  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  if (
    upstreamUrl.origin !== base.origin ||
    (basePath !== "" && !upstreamUrl.pathname.startsWith(`${basePath}/`))
  ) {
    return json("代理目标越界", 400);
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("accept-encoding", "identity");

  const method = request.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
    signal: request.signal,
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.error(
      "[agent-proxy] 上游请求失败：",
      error instanceof Error ? error.message : error,
    );
    return json("上游网关暂时不可用", 502);
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("cache-control", "no-store, no-transform");
  responseHeaders.set("x-accel-buffering", "no");
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "text/event-stream; charset=utf-8");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
