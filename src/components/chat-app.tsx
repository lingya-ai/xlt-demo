"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import {
  AgentsClient,
  OpenApiTokenFromJSON,
} from "@lingya-ai/agents-sdk/browser";
import { AgentProvider } from "@/components/xlt-agent/openapi/provider";
import { AgentChat } from "@/components/xlt-agent/blocks/agent-chat";
import { Button } from "@/components/xlt-agent/ui/components/button";

type Props = {
  channelId: string;
};

export function ChatApp({ channelId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialConversationId =
    searchParams.get("conversation") ?? undefined;

  // 只在挂载时读取 URL；之后 URL 变化不反向重置聊天实例。
  const [session, setSession] = useState(() => ({
    conversationId: initialConversationId,
    key: 0,
  }));
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(initialConversationId);

  const client = useMemo(() => {
    if (!channelId) return null;
    const origin =
      typeof window === "undefined"
        ? "http://127.0.0.1:4612"
        : window.location.origin;
    return new AgentsClient({
      baseUrl: `${origin}/api/agent`,
      channelId,
      auth: {
        type: "token",
        tokenProvider: async ({ fetch, signal }) => {
          const response = await fetch("/api/agent-token", {
            method: "POST",
            signal,
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!response.ok) {
            const detail = (await response
              .json()
              .catch(() => null)) as { message?: string } | null;
            throw new Error(
              detail?.message ?? `令牌获取失败（HTTP ${response.status}）`,
            );
          }
          return OpenApiTokenFromJSON(await response.json()).token;
        },
      },
    });
  }, [channelId]);

  const handleConversationIdChange = useCallback(
    (conversationId: string | undefined) => {
      if (!conversationId) return;
      setActiveConversationId(conversationId);
      router.replace(
        `/?conversation=${encodeURIComponent(conversationId)}`,
        { scroll: false },
      );
    },
    [router],
  );

  const handleNewConversation = useCallback(() => {
    setSession((current) => ({
      conversationId: undefined,
      key: current.key + 1,
    }));
    setActiveConversationId(undefined);
    router.replace("/", { scroll: false });
  }, [router]);

  if (!channelId || !client) {
    return (
      <div className="grid h-screen place-items-center p-6">
        <div className="w-full max-w-lg rounded-lg border border-destructive/30 bg-card p-6">
          <h1 className="text-base font-semibold">缺少渠道配置</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            服务端未配置 <code className="font-mono">OPENAPI_CHANNEL_ID</code>。
            请在项目根目录的 <code className="font-mono">.env.local</code>{" "}
            中填写 OpenAPI 参数后重启开发服务器。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-sm font-semibold">XLT Agent 对话</h1>
          {activeConversationId ? (
            <span
              className="hidden truncate font-mono text-[11px] text-muted-foreground sm:inline"
              title={activeConversationId}
            >
              会话 {activeConversationId}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleNewConversation}
        >
          <Plus className="size-4" />
          新建对话
        </Button>
      </header>
      <main className="min-h-0 flex-1">
        <AgentProvider
          client={client}
          identityKey={`openapi-demo:${channelId}`}
          options={{
            streamTransport: "sse",
            onConversationIdChange: handleConversationIdChange,
          }}
        >
          <AgentChat
            key={session.key}
            conversationId={session.conversationId}
            className="h-full"
            input={{
              placeholder: "输入消息，Enter 发送，Shift+Enter 换行",
            }}
            emptyState={{
              title: "开始一段新对话",
              description:
                "消息会通过服务端一次性令牌与受限同源代理发送到已配置的 OpenAPI 渠道。",
            }}
          />
        </AgentProvider>
      </main>
    </div>
  );
}
