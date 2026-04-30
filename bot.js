import { Bot, GrammyError, HttpError } from "grammy";
import "dotenv/config";

/* ---------------- DEBUG ENV ---------------- */
console.log("[BOOT] BOT_TOKEN exists:", !!process.env.TELEGRAM_BOT_TOKEN);
console.log("[BOOT] BOT_TOKEN preview:", process.env.TELEGRAM_BOT_TOKEN?.slice(0, 10));
console.log("[BOOT] FULL BOT TOKEN:", JSON.stringify(process.env.TELEGRAM_BOT_TOKEN));

/* ---------------- SAFETY CHECK ---------------- */
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN missing (Railway env not set)");
}

/* ---------------- BOT INIT ---------------- */
export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

bot.on("channel_post", (ctx) => {
  console.log("CHANNEL ID:", ctx.chat.id);
  console.log("CHANNEL TITLE:", ctx.chat.title);
});

/* ---------------- ERROR HANDLER ---------------- */
bot.catch((err) => {
  const ctx = err.ctx;

  const user = ctx?.from
    ? `${ctx.from.id} (${ctx.from.username || ctx.from.first_name || "?"})`
    : "unknown";

  const update =
    ctx?.update?.callback_query?.data ||
    ctx?.update?.message?.text ||
    ctx?.updateType ||
    "unknown";

  const e = err.error;

  if (e instanceof GrammyError) {
    console.error(
      `[${new Date().toISOString()}] GrammyError | user=${user} | update=${update} | ${e.description}`
    );
  } else if (e instanceof HttpError) {
    console.error(
      `[${new Date().toISOString()}] HttpError | user=${user} | ${e.message}`
    );
  } else {
    console.error(
      `[${new Date().toISOString()}] HandlerError | user=${user} | update=${update}`
    );
    console.error(e);
  }
});
