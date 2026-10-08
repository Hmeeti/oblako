import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/can";
import { subscribeStudioEvents } from "@/server/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!can(user, "lead:read")) {
    return new Response("forbidden", { status: 403 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: "connected" });
      const unsub = subscribeStudioEvents(send);
      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25000);
      const close = () => {
        clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      // @ts-expect-error abort signal on request not available here; rely on cancel
      controller._close = close;
    },
    cancel() {
      /* noop */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
