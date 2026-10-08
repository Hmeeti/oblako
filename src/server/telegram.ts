/**
 * Уведомления студии в Telegram.
 * Если токен/чат не заданы — тихий no-op (кабинет остаётся источником правды).
 */
export async function notifyStudioTelegram(text: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, reason: "telegram_not_configured" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) return { ok: false, reason: "telegram_http_error" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "telegram_network_error" };
  }
}
