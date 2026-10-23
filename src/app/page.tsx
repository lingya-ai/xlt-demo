import { Suspense } from "react";
import { ChatApp } from "@/components/chat-app";

export const dynamic = "force-dynamic";

export default function Page() {
  const channelId = process.env.OPENAPI_CHANNEL_ID?.trim() ?? "";

  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center text-sm text-muted-foreground">
          正在加载对话…
        </div>
      }
    >
      <ChatApp channelId={channelId} />
    </Suspense>
  );
}
