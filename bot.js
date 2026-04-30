import { Bot, GrammyError, HttpError } from "grammy";
import "dotenv/config";

if (!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN missing in .env");
}

export const bot = new Bot(process.env.BOT_TOKEN);

/* Rich error logging: who, what, where. */
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
      `[${new Date().toISOString()}] HttpError (Telegram unreachable) | user=${user} | ${e.message}`
    );
  } else {
    console.error(
      `[${new Date().toISOString()}] HandlerError | user=${user} | update=${update}`
    );
    console.error(e);
  }
});
