import { Hono } from "npm:hono";
import { getRequesterAccessContext } from "./requester_access.ts";

const telegram = new Hono();

// ── Sanitize text to prevent Telegram MarkdownV2 injection ──
function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// ── Action emoji mapping ──
function getActionEmoji(action: string): string {
  const act = action.toUpperCase();
  if (act.includes("CREATE")) return "🟢";
  if (act.includes("UPDATE")) return "🔵";
  if (act.includes("DELETE")) return "🔴";
  if (act.includes("PAYMENT")) return "💰";
  if (act.includes("LOGIN")) return "🔑";
  return "📋";
}

// ── Format date to WIB (UTC+7) ──
function formatDateWIB(isoDate?: string): string {
  const date = isoDate ? new Date(isoDate) : new Date();
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Send notification to Telegram ──
telegram.post("/notify", async (c) => {
  try {
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get secrets from environment (stored via supabase secrets set)
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatId) {
      console.error("Telegram secrets not configured");
      return c.json({ error: "Telegram not configured" }, 500);
    }

    const body = await c.req.json();
    const { action, entity, details, user_name, user_role, created_at } = body;

    if (!action || !entity || !details) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Sanitize all user-provided strings
    const safeEntity = escapeMarkdownV2(entity || "");
    const safeDetails = escapeMarkdownV2(details || "");
    const safeName = escapeMarkdownV2(user_name || "System");
    const safeRole = escapeMarkdownV2(user_role || "");
    const safeAction = escapeMarkdownV2(action || "");
    const safeDate = escapeMarkdownV2(formatDateWIB(created_at));
    const emoji = getActionEmoji(action);

    // Build formatted Telegram message
    const message =
      `${emoji} *${safeAction}* \\| ${safeEntity}\n` +
      `\n` +
      `${safeDetails}\n` +
      `\n` +
      `👤 ${safeName} \\(${safeRole}\\)\n` +
      `🕐 ${safeDate} WIB`;

    // Send to Telegram Bot API
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error("Telegram API error:", result);
      // Fallback: retry with plain text if MarkdownV2 fails
      const plainMessage =
        `${emoji} ${action} | ${entity}\n\n` +
        `${details}\n\n` +
        `👤 ${user_name || "System"} (${user_role || ""})\n` +
        `🕐 ${formatDateWIB(created_at)} WIB`;

      const retryResponse = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainMessage,
          disable_web_page_preview: true,
        }),
      });
      const retryResult = await retryResponse.json();
      if (!retryResult.ok) {
        return c.json({ error: "Telegram send failed", details: retryResult }, 500);
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Telegram notify error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default telegram;
