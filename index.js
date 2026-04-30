import express from "express";
import QRCode from "qrcode";
import { InputFile } from "grammy";
import "dotenv/config";

import { bot } from "./bot.js";

bot.on("channel_post", (ctx) => {
  console.log("📢 CHANNEL ID:", ctx.chat.id);
  console.log("📢 CHANNEL TITLE:", ctx.chat.title);
  console.log("📢 TEXT:", ctx.channelPost?.text || "(no text)");
});

import {
  ADMIN_ID,
  DEPOSIT_LOG_CHANNEL,
  USERS_LOG_CHANNEL,
  LTC_ADDRESSES,
  LIMITS,
  getCity,
  getProduct,
  getPrice
} from "./config.js";
import {
  getSession,
  resetFlow,
  tooFast,
  escapeHtml,
  showScreen,
  detachMenu,
  startSessionGc
} from "./core.js";
import * as ui from "./ui.js";

const ts = () => new Date().toISOString();
const log = (...a) => console.log(`[${ts()}]`, ...a);
const warn = (...a) => console.warn(`[${ts()}]`, ...a);
const err = (...a) => console.error(`[${ts()}]`, ...a);

/* ---------------- USER TRACKING (PUT HERE) ---------------- */

const seenUsers = new Set();

bot.use(async (ctx, next) => {

  const u = ctx.from;

  if (!u) return next();

  if (!seenUsers.has(u.id)) {

    seenUsers.add(u.id);

    await ctx.api.sendMessage(

      USERS_LOG_CHANNEL,

      `👤 <b>NEW USER</b>

🆔 <code>${u.id}</code>

👤 @${u.username || "no_username"}

📛 ${u.first_name || ""}

⏰ ${new Date().toLocaleString()}`,

      { parse_mode: "HTML" }

    ).catch(() => {});

  }

  return next();

});

/* ---------------- PROCESS SAFETY ---------------- */

process.on("unhandledRejection", (reason) => {
  err("UnhandledRejection:", reason);
});

process.on("uncaughtException", (e) => {
  err("UncaughtException:", e);
});

/* ---------------- LTC HELPERS ---------------- */

const getRandomAddress = () =>
  LTC_ADDRESSES[Math.floor(Math.random() * LTC_ADDRESSES.length)];

const LTC_CACHE = {
  price: 80,
  fetchedAt: 0
};

const LTC_REFRESH_MS = 120_000;
let lastFail = 0;

async function refreshLTCPrice() {
  try {
    // cooldown after rate limit
    if (Date.now() - lastFail < 60_000) return;

    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) }
    );

    if (res.status === 429) {
      lastFail = Date.now();
      warn("CoinGecko rate limited (429), backing off");
      return;
    }

    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }

    const data = await res.json();
    const price = data?.litecoin?.usd;

    if (typeof price === "number" && price > 0) {
      LTC_CACHE.price = price;
      LTC_CACHE.fetchedAt = Date.now();
      log(`[LTC] updated: ${price} USD`);
    } else {
      throw new Error("Invalid price response");
    }
  } catch (e) {
    warn("[LTC] refresh failed:", e?.message || e);
  }
}

const getLTCPrice = () => LTC_CACHE.price;

/* start background refresh */
refreshLTCPrice();
setInterval(refreshLTCPrice, LTC_REFRESH_MS).unref();

/* ---------------- QR ---------------- */

async function makeQrPng(text) {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 300
  });
}

/* ---------------- GLOBAL CALLBACK MIDDLEWARE ---------------- */
/* - Always ack so Telegram removes the spinner.
   - Debounce rapid-fire clicks per user.
   - Single-flight lock so a slow handler can't be re-entered.   */

bot.on("callback_query:data", async (ctx, next) => {
  log(`BUTTON user=${ctx.from.id} data=${ctx.callbackQuery.data}`);
  await ctx.answerCallbackQuery().catch(() => {});

  const session = getSession(ctx.from.id);
  if (tooFast(session)) {
    log(`DEBOUNCED user=${ctx.from.id}`);
    return;
  }
  if (session.busy) {
    log(`BUSY user=${ctx.from.id}`);
    return;
  }
  session.busy = true;
  try {
    await next();
  } finally {
    session.busy = false;
  }
});

/* ---------------- COMMANDS ---------------- */
/* /start does NOT null messageId — it edits the existing menu in
   place when possible, so repeating /start does not stack messages. */

bot.command("start", async (ctx) => {
  log(`START user=${ctx.from.id}`);
  const session = getSession(ctx.from.id);
  resetFlow(session);
  // Always land at the bottom of the chat, even if the previous menu
  // is buried above a photo (e.g. the deposit QR).
  await detachMenu(ctx);
  const { text, kb } = ui.home();
  await showScreen(ctx, text, kb);
});

bot.command("cancel", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);
  await detachMenu(ctx);
  const { text, kb } = ui.home();
  await showScreen(ctx, text, kb);
});

/* ---------------- NAVIGATION ---------------- */

bot.callbackQuery("nav:home", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);
  const { text, kb } = ui.home();
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("nav:profile", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);
  const { text, kb } = ui.profile(ctx, session);
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("nav:rules", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);
  const { text, kb } = ui.rules();
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("nav:city", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);
  const { text, kb } = ui.cityList();
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("nav:oferte", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);

  await showScreen(
    ctx,
    "🔜 <b>Angajăm dropperi</b>\n\n📢 Ne extindem comunitatea și în următoarele zile vom pune la dispoziție posibilitatea de angajare.\n\n💼 Oferta de job va fi disponibila in bot curand.\n\n⏳ Vă ținem la curent cu toate detaliile.\n\n⚠️ Vă rugăm să nu folosiți 🆘 SUPPORT pentru întrebări legate de oferte.",
    {
      inline_keyboard: [
        [{ text: "🏠 Acasă", callback_data: "nav:home" }]
      ]
    }
  );
});


/* ---------------- REVIEWS (public) ---------------- */

bot.callbackQuery("nav:reviews", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);
  const { text, kb } = ui.reviewsList(0);
  await showScreen(ctx, text, kb);
});

bot.callbackQuery(/^reviews:page:(-?\d{1,4})$/, async (ctx) => {
  const page = Number(ctx.match[1]);
  const { text, kb } = ui.reviewsList(page);
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("noop", async () => { /* page-indicator button */ });

bot.callbackQuery("review:add", async (ctx) => {
  // Reviews are admin-curated only. Users cannot add their own:
  // they always see the "no order yet" gate.
  log(`REVIEW_ADD_BLOCKED user=${ctx.from.id}`);
  const { text, kb } = ui.reviewNoOrder();
  await showScreen(ctx, text, kb);
});

/* ---------------- BUY FLOW ---------------- */

bot.callbackQuery(/^city:([a-z0-9_-]{1,32})$/i, async (ctx) => {
  const session = getSession(ctx.from.id);
  const cityId = ctx.match[1];
  if (!getCity(cityId)) {
    const { text, kb } = ui.cityList();
    return showScreen(ctx, text, kb);
  }
  session.selection.city = cityId;
  session.selection.productId = null;
  session.selection.quantity = null;
  const { text, kb } = ui.productList(cityId);
  await showScreen(ctx, text, kb);
});

bot.callbackQuery(/^product:([a-z0-9_-]{1,32})$/i, async (ctx) => {
  const session = getSession(ctx.from.id);
  const cityId = session.selection.city;
  const productId = ctx.match[1];
  if (!getProduct(cityId, productId)) {
    const { text, kb } = ui.productList(cityId);
    return showScreen(ctx, text, kb);
  }
  session.selection.productId = productId;
  session.selection.quantity = null;
  const { text, kb } = ui.qtyList(cityId, productId);
  await showScreen(ctx, text, kb);
});

bot.callbackQuery(/^qty:(\d{1,4})$/, async (ctx) => {
  const session = getSession(ctx.from.id);
  const { city, productId } = session.selection;
  const qty = Number(ctx.match[1]);
  if (getPrice(city, productId, qty) === null) {
    const { text, kb } = ui.qtyList(city, productId);
    return showScreen(ctx, text, kb);
  }
  session.selection.quantity = qty;
  const { text, kb } = ui.paymentConfirm(session);
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("pay:confirm", async (ctx) => {
  const session = getSession(ctx.from.id);
  const { city, productId, quantity } = session.selection;
  const product = getProduct(city, productId);
  const price = getPrice(city, productId, quantity);

  if (!product || price === null) {
    resetFlow(session);
    const { text, kb } = ui.home();
    return showScreen(ctx, text, kb);
  }

  if (session.balance < price) {
    const { text, kb } = ui.paymentInsufficient(price, session.balance);
    return showScreen(ctx, text, kb);
  }

  session.balance -= price;
  log(
    `ORDER user=${ctx.from.id} city=${city} product=${productId} qty=${quantity} price=${price} new_balance=${session.balance}`
  );
  resetFlow(session);
  const { text, kb } = ui.paymentSuccess(
    product,
    quantity,
    price,
    session.balance
  );
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("pay:cancel", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);
  const { text, kb } = ui.paymentCancelled();
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("deposit:ltc", async (ctx) => {
  const session = getSession(ctx.from.id);

  // If the user has a pending order, charge them the missing amount
  // (price - current balance). Otherwise fall back to the minimum so
  // the flow is never blocked.
  const { city, productId, quantity } = session.selection || {};
  const orderPrice = getPrice(city, productId, quantity);
  const target =
    typeof orderPrice === "number" && orderPrice > 0
      ? orderPrice - (session.balance || 0)
      : LIMITS.depositMin;

  const amount = Math.max(
    LIMITS.depositMin,
    Math.min(LIMITS.depositMax, Math.ceil(target))
  );

  session.mode = "idle";

  const ltcPrice = getLTCPrice();
  const ltcAmount = (amount / ltcPrice).toFixed(6);
  const address = getRandomAddress();

  const u = ctx.from;

await ctx.api.sendMessage(
  DEPOSIT_LOG_CHANNEL,
  `✅ <b>DEPOSIT INITIATED</b>

👤 ${u.username ? "@" + u.username : u.first_name}
🆔 <code>${u.id}</code>

💵 ${amount} USD
🔢 ${ltcAmount} LTC

🏦 <b>${address}</b>

⏰ ${new Date().toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })}
`,
  { parse_mode: "HTML" }
).catch(() => {});

  try {
    const qrPng = await makeQrPng(address);

    await ctx.replyWithPhoto(new InputFile(qrPng, "ltc.png"), {
      parse_mode: "HTML",
      caption:
`<b>Detalii plată LTC:</b>

<code>${address}</code>
<b>${ltcAmount} LTC</b> (~${amount} USD)

⏳ Ai 60 minute pentru a trimite suma.`
    });

  } catch (e) {
    err(
      `Deposit QR send failed (user=${ctx.from.id}):`,
      e?.description || e
    );

    return ctx.reply(
      "❌ Nu am putut genera detaliile de plată. Încearcă din nou."
    );
  }

  log(
    `DEPOSIT user=${ctx.from.id} amount=${amount} ltc=${ltcAmount} addr=${address}`
  );

  await detachMenu(ctx);

  const { text, kb } = ui.depositSubmitted(amount);

  await showScreen(ctx, text, kb);
});

/* ---------------- SUPPORT ---------------- */

bot.callbackQuery("nav:support", async (ctx) => {
  const session = getSession(ctx.from.id);
  resetFlow(session);
  const { text, kb } = ui.supportConfirm();
  await showScreen(ctx, text, kb);
});

bot.callbackQuery("support:yes", async (ctx) => {
  const session = getSession(ctx.from.id);
  session.mode = "support_input";
  const { text, kb } = ui.supportPrompt();
  await showScreen(ctx, text, kb);
});

/* ---------------- ADMIN DELIVERY ---------------- */

async function deliverToAdmin(ctx) {
  const u = ctx.from;

  const username = u.username
    ? `@${escapeHtml(u.username)}`
    : "(no username)";

  const name = escapeHtml(
    [u.first_name, u.last_name].filter(Boolean).join(" ") || "User"
  );

  // First message = sender info
  await ctx.api.sendMessage(
    ADMIN_ID,
    `📩 <b>NEW SUPPORT MESSAGE</b>

👤 ${name} ${username}
🆔 <code>${u.id}</code>

⏰ ${new Date().toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })}`,
    { parse_mode: "HTML" }
  );

  // Second message = copied content ONLY (no "forwarded from")
  try {
    await ctx.api.copyMessage(
      ADMIN_ID,
      ctx.chat.id,
      ctx.message.message_id
    );
  } catch (e) {
    warn(
      `copyMessage failed (user=${u.id}): ${
        e?.description || e?.message || e
      }`
    );
  }
}

/* ---------------- USER INPUT ROUTER ---------------- */
/* One handler routes by session.mode. Commands handled above
   never reach here because their handlers don't call next(). */

bot.on("message", async (ctx) => {
  // Ignore unknown slash-commands quietly.
  if (ctx.message.text && ctx.message.text.startsWith("/")) return;

  const session = getSession(ctx.from.id);

  /* ---- SUPPORT INPUT ---- */
  if (session.mode === "support_input") {
    const isText = !!ctx.message.text;
    const isPhoto = !!ctx.message.photo;

    if (!isText && !isPhoto) {
      return ctx.reply("❌ Trimite doar text sau o poză.");
    }
    if (isText && ctx.message.text.length > LIMITS.supportMaxLen) {
      return ctx.reply(
        `❌ Mesaj prea lung (max ${LIMITS.supportMaxLen} caractere).`
      );
    }
    if (
      ctx.message.caption &&
      ctx.message.caption.length > LIMITS.supportMaxLen
    ) {
      return ctx.reply(
        `❌ Captionul este prea lung (max ${LIMITS.supportMaxLen} caractere).`
      );
    }

    // Lock immediately to prevent double-send.
    session.mode = "idle";

    try {
      await deliverToAdmin(ctx);
      log(`SUPPORT user=${ctx.from.id} kind=${isPhoto ? "photo" : "text"}`);
    } catch (e) {
      err(`Support delivery failed (user=${ctx.from.id}):`, e?.description || e);
      return ctx.reply(
        "❌ Nu am putut trimite mesajul. Încearcă din nou mai târziu."
      );
    }

    // Same trick as deposit: post the confirmation below the user's
    // typed message instead of editing the menu hidden above.
    await detachMenu(ctx);
    const { text, kb } = ui.supportSent();
    return showScreen(ctx, text, kb);
  }

  // Idle — ignore stray messages quietly.
});

 async function notifyUser() {
  const userId = 6927105767;

  try {
    await bot.api.sendMessage(
      userId,
      "📢 Bot is now online and running."
    );
    console.log("Auto message sent to user:", userId);
  } catch (e) {
    console.error("Auto send failed:", e);
  }
}

/* ---------------- HTTP / UPTIMEROBOT ---------------- */

const startedAt = Date.now();
const app = express();
app.disable("x-powered-by");
app.use(express.json());

// Lightweight root for any pinger.
app.get("/", (_req, res) => res.type("text/plain").send("Bot running"));

// Rich health endpoint for UptimeRobot / monitoring.
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString()
  });
});

// 404 catch-all so monitors don't see HTML noise.
app.use((_req, res) => res.status(404).type("text/plain").send("not found"));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => log(`HTTP listening on :${PORT}`));

// Drop sessions that have been inactive for a week so the in-memory
// store doesn't grow forever on a 24/7 deployment.
startSessionGc();

/* ---------------- BOT START ---------------- */

/* Wrap bot.start so a Telegram polling conflict (another instance
   already running, e.g. during a redeploy or when the workspace dev
   workflow is also up) is not fatal. We back off and retry instead
   of killing the process — the moment the other poller dies, this
   one takes over cleanly. */

async function startBotForever() {
  let attempt = 0;
  while (true) {
    try {
      await bot.start({
        onStart: (info) => log(`BOT online as @${info.username}`),
        drop_pending_updates: true
      });
      // Resolves only when bot.stop() is called.
      return;
    } catch (e) {
      const desc = e?.description || e?.message || String(e);
      attempt += 1;

      if (desc.includes("Conflict")) {
        const waitMs = Math.min(30_000, 2_000 * attempt);
        warn(
          `Another bot instance is polling Telegram. Waiting ${Math.round(
            waitMs / 1000
          )}s before retry (attempt ${attempt}).`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      err(`bot.start failed (fatal): ${desc}`);
      process.exit(1);
    }
  }
}

console.log("MIDDLEWARE STACK:", bot.middleware?.length || "unknown");

async function boot() {
  await notifyUser();        // 👈 runs first
  await startBotForever();   // 👈 then bot runs forever
}

boot();
