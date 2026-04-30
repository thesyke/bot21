import { db } from "./db.js";
import { LIMITS } from "./config.js";

const newSession = () => ({
  balance: 0,
  messageId: null,
  mode: "idle", // "idle" | "deposit_amount" | "support_input"
  selection: { city: null, productId: null, quantity: null },
  lastClickAt: 0,
  lastSeenAt: Date.now(),
  busy: false // single-flight lock: prevents two handlers from racing
});

export function getSession(userId) {
  if (!db.sessions[userId]) {
    db.sessions[userId] = newSession();
  }
  const s = db.sessions[userId];
  s.lastSeenAt = Date.now();
  return s;
}

/* Drop sessions that have been idle for a long time so the in-memory
   store doesn't grow forever on a 24/7 deployment. */
export function startSessionGc({ ttlMs = 1000 * 60 * 60 * 24 * 7, intervalMs = 1000 * 60 * 30 } = {}) {
  setInterval(() => {
    const cutoff = Date.now() - ttlMs;
    let removed = 0;
    for (const [uid, s] of Object.entries(db.sessions)) {
      if (s.lastSeenAt < cutoff) {
        delete db.sessions[uid];
        removed++;
      }
    }
    if (removed) {
      console.log(`[${new Date().toISOString()}] session-gc removed ${removed} idle sessions`);
    }
  }, intervalMs).unref();
}

export function resetFlow(session) {
  session.mode = "idle";
  session.selection = { city: null, productId: null, quantity: null };
}

/* Debounce rapid clicks per-user (anti-spam / anti-double-fire). */
export function tooFast(session) {
  const now = Date.now();
  if (now - session.lastClickAt < LIMITS.clickCooldownMs) return true;
  session.lastClickAt = now;
  return false;
}

/* Try to delete the active inline-menu message and forget its id.
   Used when we want the next render to appear at the bottom of the
   chat (e.g. right after sending a photo). */
export async function detachMenu(ctx) {
  const session = getSession(ctx.from.id);
  if (!session.messageId) return;
  const id = session.messageId;
  session.messageId = null;
  try {
    await ctx.api.deleteMessage(ctx.chat.id, id);
  } catch {
    /* already gone, too old, or no permission — ignore */
  }
}

export function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* Edit the existing screen if possible, otherwise send a fresh one.
   Silently swallows the harmless "message is not modified" error,
   logs everything else for visibility. */
export async function showScreen(ctx, text, kb) {
  const session = getSession(ctx.from.id);
  const chatId = ctx.chat.id;

  if (session.messageId) {
    try {
      await ctx.api.editMessageText(chatId, session.messageId, text, {
        reply_markup: kb,
        parse_mode: "HTML",
        disable_web_page_preview: true
      });
      return;
    } catch (err) {
      const desc = err?.description || err?.message || "";

      if (desc.includes("message is not modified")) return;

      // Common: "message to edit not found", "message can't be edited"
      // (>48h old). Falling through to send a new message is correct.
      // Anything truly unexpected gets logged.
      const recoverable =
        desc.includes("message to edit not found") ||
        desc.includes("message can't be edited") ||
        desc.includes("MESSAGE_ID_INVALID");

      if (!recoverable) {
        console.warn(
          `[${new Date().toISOString()}] showScreen edit failed (user=${ctx.from.id}): ${desc}`
        );
      }
      session.messageId = null;
    }
  }

  try {
    const msg = await ctx.api.sendMessage(chatId, text, {
      reply_markup: kb,
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
    session.messageId = msg.message_id;
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] showScreen send failed (user=${ctx.from.id}):`,
      err?.description || err
    );
    throw err;
  }
}
