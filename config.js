/* ============================================================
   SINGLE SOURCE OF TRUTH

   To add a city:        add an entry to CATALOG.
   To remove a city:     delete the entry (or set enabled:false).
   To add a product:     add it under that city's "products" map.
   To change a price:    edit the "prices" map (qty -> price USD).
   To change admin:      edit ADMIN_ID.
   To change LTC pool:   edit LTC_ADDRESSES.
   ============================================================ */

export const ADMIN_ID = 7960378306;

export const CATALOG = {
  ploiesti: {
    label: "Ploiești",
    enabled: true,
    products: {
      wd: { label: "verde", prices: { 5: 60, 10: 111 } },
      cx: { label: "cx", prices: { 1: 110, 2: 200 } }
    }
  },
  iasi: {
    label: "Iași",
    enabled: true,
    products: {
      wd: { label: "verde", prices: { 5: 60, 10: 111 } },
      cx: { label: "cx", prices: { 1: 110, 2: 200 } }
    }
  },
  buzau: {
    label: "Buzău",
    enabled: false,
    products: {}
  }
};

export const LTC_ADDRESSES = [
  "ltc1q7vxajhpsd53tudx6pulglku0h8avajezt2r4u0",
  "ltc1qkjaan2jjvp65he8qn6lt9a4pwn7x4d6c80ha27",
  "ltc1q5gzenqfj28vd8dxfuc7rrkv0ra9qrwncez4adp",
  "ltc1qu3vf9zreklst2nwrk0r56d63cnf9zw9qg8u232",
  "ltc1qtux9ys4ueay24f8x5ukt3dy2d8v70y68kxwfhg",
  "ltc1qu5pehgw00c8qhfayezz9jmylsm9he96tz0ydw8",
  "ltc1qj4puy2cecqhr6pm0azqnuzxpagqupgaetae6sl"
];

export const LIMITS = {
  depositMin: 1,
  depositMax: 2000,
  supportMaxLen: 2000,
  clickCooldownMs: 400
};

/* ============================================================
   REVIEWS
   ------------------------------------------------------------
   This is the ONLY file you edit to add reviews.
   Add as many entries as you want, save, redeploy — done.

   Each review has 4 fields:
     stars : number from 1 to 5     (shown as ★ stars)
     text  : the review body text
     date  : "DD.MM.YYYY"           e.g. "29.04.2026"
     time  : "HH:MM"   (24h)        e.g. "18:14"

   Newest review (date + time) is shown first automatically.
   The public list paginates 3 per page with ◀ / ▶ buttons.

   To start with no reviews, leave the array empty:  []
   ------------------------------------------------------------
   Example — copy a block, paste it inside the [ ], edit it:

   {
     stars: 5,
     text:  "Drop perfect, coordonate exacte. Recomand!",
     date:  "29.04.2026",
     time:  "18:14"
   },
   ============================================================ */
export const REVIEWS = [
     {
     stars: 5,
     text:  "top",
     date:  "15.04.2026",
     time:  "18:14"
   },
     {
     stars: 5,
     text:  "bun wdul",
     date:  "18.04.2026",
     time:  "02:41"
   },
   {
     stars: 4,
     text:  "cogox bun, locatia cam aiurea m-a vazut un mosneag cum sapam:))))",
     date:  "18.04.2026",
     time:  "11:21"
   },
   {
      stars: 5,
      text:  "👍🏻",
      date: "20.04.2026",
      time: "21:38"
   },
   {
     stars: 5,
     text:  "calitate, scz am uitat sa las review",
     date:  "20.04.2026",
     time:  "23:04"
   }

];

export const REVIEWS_PER_PAGE = 3;

/* ---------------- VALIDATED LOOKUPS ---------------- */
/* All lookups go through these so callback_data can never
   reach into prototypes or unknown keys.                */

const isOwn = (obj, key) =>
  typeof key === "string" && Object.hasOwn(obj, key);

export const listCities = () =>
  Object.entries(CATALOG)
    .filter(([, c]) => c.enabled)
    .map(([id, c]) => ({ id, label: c.label }));

export const getCity = (id) => {
  if (!isOwn(CATALOG, id)) return null;
  const c = CATALOG[id];
  return c && c.enabled ? c : null;
};

export const listProducts = (cityId) => {
  const c = getCity(cityId);
  if (!c) return [];
  return Object.entries(c.products).map(([id, p]) => ({
    id,
    label: p.label
  }));
};

export const getProduct = (cityId, productId) => {
  const c = getCity(cityId);
  if (!c || !isOwn(c.products, productId)) return null;
  return c.products[productId];
};

export const listQuantities = (cityId, productId) => {
  const p = getProduct(cityId, productId);
  if (!p) return [];
  return Object.entries(p.prices).map(([qty, price]) => ({
    qty: Number(qty),
    price
  }));
};

export const getPrice = (cityId, productId, qty) => {
  const p = getProduct(cityId, productId);
  if (!p) return null;
  const n = Number(qty);
  if (!Number.isInteger(n) || n <= 0) return null;
  if (!Object.hasOwn(p.prices, String(n))) return null;
  const v = p.prices[n];
  return typeof v === "number" && v > 0 ? v : null;
};
