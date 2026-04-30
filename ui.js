import {
  listCities,
  listProducts,
  listQuantities,
  getCity,
  getProduct,
  getPrice,
  LIMITS,
  REVIEWS,
  REVIEWS_PER_PAGE
} from "./config.js";
import { escapeHtml } from "./core.js";

const HOME_BTN = { text: "🏠 Acasă", callback_data: "nav:home" };

export function home() {
  return {
    text: "📍 <b>Meniu principal</b>\n\nAlege o opțiune:",
    kb: {
      inline_keyboard: [
        [{ text: "👤 Profil", callback_data: "nav:profile" }],
        [{ text: "🛒 Comandă", callback_data: "nav:city" }],
        [  
          { text: "📜 Reguli", callback_data: "nav:rules" }
        ],
        [
          { text: "⭐ Recenzii", callback_data: "nav:reviews" },
          { text: "🆘 SUPPORT", callback_data: "nav:support" }
        ]
      ]
    }
  };
}

export function profile(ctx, session) {
  const username = ctx.from.username
    ? `@${escapeHtml(ctx.from.username)}`
    : escapeHtml(ctx.from.first_name || "User");

  const referralLink = `https://t.me/verdenovabot?start=${ctx.from.id}`;

  return {
    text:
`👤 Username: ${username}
🆔 ID: <code>${ctx.from.id}</code>

💰 Balanță: <b>${session.balance.toFixed(2)} USD</b>

🎁 <b>Invită un prieten și primești bonus:</b>
<a href="${referralLink}">${referralLink}</a>`,
    kb: { inline_keyboard: [[HOME_BTN]] }
  };
}

export function rules() {
  return {
    text:
`📜 <b>Reguli</b>

Pentru a te asigura ca totul decurge bine si ca nu ai probleme, te rugam sa urmezi urmatoarele reguli:

<b> NU GASESC DROPUL, CE FAC? </b>

Trimite folosind butonul 🆘<b>SUPPORT</b> urmatoarele informatii:

1. Poza cu dropul din bot
2. Video realizat <b>INAINTE</b> de a ajunge la drop
3. Poze din minim doua unghiuri diferite
4. Daca coordonatele nu corespund cu cele din bot, trimite screenshot cu locatia in aplicatia folosita de a ajunge acolo (de ex Google Maps)

⏳ Termen: max 6 ore
⚠️ Cererile incomplete vor fi respinse`,
    kb: { inline_keyboard: [[HOME_BTN]] }
  };
}

export function cityList() {
  const cities = listCities();
  if (!cities.length) {
    return {
      text: "❌ Momentan nu există orașe disponibile.",
      kb: { inline_keyboard: [[HOME_BTN]] }
    };
  }
  return {
    text: "📍 Alege orașul:",
    kb: {
      inline_keyboard: [
        ...cities.map((c) => [
          { text: c.label, callback_data: `city:${c.id}` }
        ]),
        [HOME_BTN]
      ]
    }
  };
}

export function productList(cityId) {
  const city = getCity(cityId);
  if (!city) {
    return {
      text: "❌ Oraș indisponibil.",
      kb: { inline_keyboard: [[HOME_BTN]] }
    };
  }
  const products = listProducts(cityId);
  if (!products.length) {
    return {
      text: `📍 ${escapeHtml(city.label)}\n\n❌ Nu există produse disponibile.`,
      kb: {
        inline_keyboard: [
          [{ text: "⬅ Orașe", callback_data: "nav:city" }],
          [HOME_BTN]
        ]
      }
    };
  }
  return {
    text: `📍 ${escapeHtml(city.label)}\n\n📦 Alege produsul:`,
    kb: {
      inline_keyboard: [
        ...products.map((p) => [
          { text: p.label, callback_data: `product:${p.id}` }
        ]),
        [{ text: "⬅ Orașe", callback_data: "nav:city" }],
        [HOME_BTN]
      ]
    }
  };
}

export function qtyList(cityId, productId) {
  const city = getCity(cityId);
  const product = getProduct(cityId, productId);
  if (!city || !product) {
    return {
      text: "❌ Selecție invalidă.",
      kb: { inline_keyboard: [[HOME_BTN]] }
    };
  }
  const items = listQuantities(cityId, productId);
  if (!items.length) {
    return {
      text: `📍 ${escapeHtml(city.label)} • ${escapeHtml(product.label)}\n\n❌ Fără cantități disponibile.`,
      kb: {
        inline_keyboard: [
          [{ text: "⬅ Produse", callback_data: `city:${cityId}` }],
          [HOME_BTN]
        ]
      }
    };
  }
  return {
    text: `📍 ${escapeHtml(city.label)} • ${escapeHtml(product.label)}\n\n Alege cantitatea:`,
    kb: {
      inline_keyboard: [
        ...items.map((i) => [
          {
            text: `${i.qty} × ${product.label} — ${i.price} USD`,
            callback_data: `qty:${i.qty}`
          }
        ]),
        [{ text: "⬅ Produse", callback_data: `city:${cityId}` }],
        [HOME_BTN]
      ]
    }
  };
}

export function paymentConfirm(session) {
  const { city: cityId, productId, quantity } = session.selection;
  const city = getCity(cityId);
  const product = getProduct(cityId, productId);
  const price = getPrice(cityId, productId, quantity);

  if (!city || !product || price === null) {
    return {
      text: "❌ Date comandă invalide.",
      kb: { inline_keyboard: [[HOME_BTN]] }
    };
  }

  return {
    text:
` <b>Confirmare comandă</b>

📍 Oraș: <b>${escapeHtml(city.label)}</b>
📦 Produs: <b>${escapeHtml(product.label)}</b>
🔢 Cantitate: <b>${quantity}</b>
💰 Preț: <b>${price} USD</b>

💳 Balanța ta: <b>${session.balance.toFixed(2)} USD</b>`,
    kb: {
      inline_keyboard: [
        [{ text: "✅ Confirm", callback_data: "pay:confirm" }],
        [{ text: "❌ Anulează", callback_data: "pay:cancel" }]
      ]
    }
  };
}

export function paymentSuccess(product, qty, price, balance) {
  return {
    text:
`✅ <b>Plată efectuată</b>

📦 Produs: ${escapeHtml(product.label)}
🔢 Cantitate: ${qty}
💰 Plătit: ${price} USD

💳 Balanță rămasă: <b>${balance.toFixed(2)} USD</b>`,
    kb: { inline_keyboard: [[HOME_BTN]] }
  };
}

export function paymentInsufficient(price, balance) {
  return {
    text:
`❌ <b>Balanță insuficientă</b>

💰 Necesar: ${price} USD
💳 Balanța ta: ${balance.toFixed(2)} USD`,
    kb: {
      inline_keyboard: [
        [{ text: "📦 Depozit", callback_data: "nav:deposit" }],
        [HOME_BTN]
      ]
    }
  };
}

export function paymentCancelled() {
  return {
    text: "❌ Comandă anulată.",
    kb: { inline_keyboard: [[HOME_BTN]] }
  };
}

export function depositMethod() {
  return {
    text: "💳 Alege metoda de plată:",
    kb: {
      inline_keyboard: [
        [{ text: "LTC", callback_data: "deposit:ltc" }],
        [HOME_BTN]
      ]
    }
  };
}

export function depositAmountPrompt() {
  return {
    text: `💰 Introdu suma în USD (${LIMITS.depositMin} - ${LIMITS.depositMax}):`,
    kb: { inline_keyboard: [[HOME_BTN]] }
  };
}

export function depositSubmitted(amount) {
  return {
    text:
`✅ <b>Cerere de depozit creată</b>

Suma: <b>${amount} USD</b>

Detaliile de plată au fost trimise mai sus.`,
    kb: { inline_keyboard: [[HOME_BTN]] }
  };
}

export function supportConfirm() {
  return {
    text:
`🆘 <b>Support</b>

Vrei să trimiți un mesaj sau o poză către admin?`,
    kb: {
      inline_keyboard: [
        [{ text: "✅ Da, continuă", callback_data: "support:yes" }],
        [{ text: "❌ Nu", callback_data: "nav:home" }]
      ]
    }
  };
}

export function supportPrompt() {
  return {
    text:
`📨 Trimite acum <b>un singur mesaj</b> (text sau poză).
Va fi transmis adminului.

⚠️ Apasă Acasă dacă vrei să anulezi.`,
    kb: { inline_keyboard: [[HOME_BTN]] }
  };
}

export function supportSent() {
  return {
    text: "✅ Mesajul a fost trimis adminului. Iti vom raspunde in maxim <b> 8 ore</b>.",
    kb: { inline_keyboard: [[HOME_BTN]] }
  };
}

/* ---------------- REVIEWS ---------------- */

/* ---------------- REVIEWS ---------------- */

const STAR_FILLED = "★";
const STAR_EMPTY = "☆";

function renderStars(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return STAR_FILLED.repeat(n) + STAR_EMPTY.repeat(5 - n);
}

/* Parse "DD.MM.YYYY" + "HH:MM" into a sortable timestamp (ms).
   Returns 0 if either field is missing/invalid (those reviews
   sink to the bottom but still render). */
function reviewTimestamp(r) {
  const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(r.date || "").trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(r.time || "").trim());
  if (!dm) return 0;
  const [, d, mo, y] = dm;
  const [h, mi] = tm ? [tm[1], tm[2]] : ["0", "0"];
  const t = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}

function renderReview(r) {
  const stars = renderStars(r.stars);
  const date = escapeHtml(r.date || "");
  const time = escapeHtml(r.time || "");
  const when = [date, time].filter(Boolean).join(" ");
  const text = escapeHtml(r.text || "");
  return (
`${stars}
🕒 <i>${when || "—"}</i>

${text}`
  );
}

/* Public list, paginated REVIEWS_PER_PAGE per page (config.js).
   Newest review first (sorted by date+time desc). Pagination wraps.
   REVIEWS is a static config, so we sort once at module load. */

const SORTED_REVIEWS = [...REVIEWS].sort(
  (a, b) => reviewTimestamp(b) - reviewTimestamp(a)
);

export function reviewsList(page = 0) {
  const all = SORTED_REVIEWS;
  const total = all.length;

  if (total === 0) {
    return {
      text: "⭐ <b>Recenzii</b>\n\nMomentan nu există recenzii.",
      kb: {
        inline_keyboard: [
          [{ text: "✍️ Lasă o recenzie", callback_data: "review:add" }],
          [HOME_BTN]
        ]
      }
    };
  }

  const perPage = Math.max(1, Number(REVIEWS_PER_PAGE) || 3);
  const pages = Math.ceil(total / perPage);
  const p = ((page % pages) + pages) % pages;
  const slice = all.slice(p * perPage, (p + 1) * perPage);

  const body = slice.map(renderReview).join("\n\n———\n\n");

  const rows = [];
  if (pages > 1) {
    rows.push([
      { text: "◀", callback_data: `reviews:page:${p - 1}` },
      { text: `${p + 1}/${pages}`, callback_data: "noop" },
      { text: "▶", callback_data: `reviews:page:${p + 1}` }
    ]);
  }
  rows.push([{ text: "✍️ Lasă o recenzie", callback_data: "review:add" }]);
  rows.push([HOME_BTN]);

  return {
    text: `⭐ <b>Recenzii</b>\n\n${body}`,
    kb: { inline_keyboard: rows }
  };
}

export function reviewNoOrder() {
  return {
    text: "❌ <b>You do not have an order yet</b>",
    kb: {
      inline_keyboard: [
        [{ text: "⬅ Recenzii", callback_data: "nav:reviews" }],
        [HOME_BTN]
      ]
    }
  };
}
