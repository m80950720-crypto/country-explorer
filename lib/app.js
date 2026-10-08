const express = require("express");
const path = require("path");

const app = express();

// Node >= 18 ships a global fetch, so no extra dependency is needed.
if (typeof fetch !== "function") {
  throw new Error("This app needs Node.js 18 or newer (global fetch is missing).");
}
console.log(`[startup] Node.js ${process.version}`);

// restcountries.com v1-v4 were shut down (v5 needs an account + API key), so this app
// now uses countries.dev: free, keyless, same kind of data.
const API_BASE = "https://countries.dev";
const LIST_FIELDS = "name,alpha3Code,flags,population,region,capital";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Simple in-memory cache.
// Note: on Vercel, each serverless invocation may run on a fresh instance,
// so this cache mainly helps warm instances / local development. It still
// meaningfully cuts down on repeat calls to restcountries.com.
const cache = new Map();

function getCached(key, { allowStale = false } = {}) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (!allowStale && Date.now() - entry.time > CACHE_TTL_MS) return null;
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, time: Date.now() });
}

// ---------- Upstream fetching (hardened) ----------
// restcountries.com is slow from some regions and sits behind Cloudflare.
// So: generous timeout, up to 3 attempts with backoff, and the header set
// is varied between attempts (some networks/bot-filters reject one style).
const REQUEST_TIMEOUT_MS = 8000; // Vercel hobby functions are capped at ~10s
const MAX_ATTEMPTS = 2;

const HEADER_SETS = [
  { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" },
  { Accept: "application/json" },
  { Accept: "*/*", "User-Agent": "CountryExplorer/1.0" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Turns a low-level fetch failure into a short, human-readable reason. */
function describeError(err) {
  const code = err?.cause?.code || err?.code || "";
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return "timeout - restcountries.com did not answer in time";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS failure - cannot resolve restcountries.com (check internet/DNS)";
  if (code === "ECONNREFUSED") return "connection refused";
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "connection reset (network/firewall interrupted it)";
  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") return "connect timeout - restcountries.com is unreachable from this network";
  if (code === "CERT_HAS_EXPIRED" || /certificate|SSL|TLS/i.test(code + err?.message)) return "TLS/certificate problem (antivirus/proxy intercepting HTTPS?)";
  if (err?.upstreamStatus) return `upstream returned HTTP ${err.upstreamStatus}`;
  return err?.message || "unknown error";
}

async function fetchOnce(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) {
    const snippet = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status}: ${snippet.slice(0, 160)}`);
    err.upstreamStatus = res.status;
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }
  return res.json();
}

async function fetchJSON(url) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchOnce(url, HEADER_SETS[attempt % HEADER_SETS.length]);
    } catch (err) {
      lastErr = err;
      if (err.status === 404) throw err; // a real "not found" - don't retry
      console.warn(`[fetchJSON] attempt ${attempt + 1}/${MAX_ATTEMPTS} failed for ${url} -> ${describeError(err)}`);
      if (attempt < MAX_ATTEMPTS - 1) await sleep(600 * (attempt + 1));
    }
  }
  lastErr.reason = describeError(lastErr);
  throw lastErr;
}

// ---------- Normalizers: countries.dev -> the shape the frontend uses ----------
function normalizeCountry(c) {
  const languages = {};
  (c.languages || []).forEach((l, i) => { languages[l.iso639_2 || l.iso639_1 || i] = l.name; });
  const currencies = {};
  (c.currencies || []).forEach((cur, i) => { currencies[cur.code || i] = { name: cur.name, symbol: cur.symbol }; });
  const flagSvg = c.flags?.svg || "";
  return {
    name: { common: c.name, official: c.name, native: c.nativeName || null },
    cca3: c.alpha3Code,
    cca2: c.alpha2Code,
    flags: { svg: flagSvg, png: c.flags?.png || "", alt: `Flag of ${c.name}` },
    flag: c.flag || "",
    population: typeof c.population === "number" ? c.population : null,
    region: c.region || "",
    subregion: c.subregion || "",
    capital: c.capital ? [c.capital] : [],
    area: c.area ?? null,
    languages,
    currencies,
    borders: Array.isArray(c.borders) ? c.borders : [],
  };
}

function isValidList(data) {
  return Array.isArray(data) && data.length > 0 && data[0] && data[0].alpha3Code;
}

async function loadAllCountries() {
  const cacheKey = "countries:all";
  const cached = getCached(cacheKey);
  if (cached) return { data: cached, cache: "HIT" };
  try {
    // Try the slim (fields=) request first, fall back to the default response.
    let raw;
    try {
      raw = await fetchJSON(`${API_BASE}/countries?fields=${LIST_FIELDS}`);
      if (!isValidList(raw)) throw new Error("unexpected response shape");
    } catch (e) {
      console.warn("[countries] slim request failed, retrying without fields:", e.message);
      raw = await fetchJSON(`${API_BASE}/countries`);
      if (!isValidList(raw)) throw new Error("unexpected response shape from countries.dev");
    }
    const data = raw.map(normalizeCountry).filter((c) => c.cca3);
    setCached(cacheKey, data);
    return { data, cache: "MISS" };
  } catch (err) {
    const stale = getCached(cacheKey, { allowStale: true });
    if (stale) return { data: stale, cache: "STALE" };
    throw err;
  }
}

// ---------- API routes ----------

// GET /api/countries - list of all countries (name, flag, population, region, capital)
app.get("/api/countries", async (req, res) => {
  try {
    const { data, cache: state } = await loadAllCountries();
    res.setHeader("X-Cache", state);
    res.json(data);
  } catch (err) {
    console.error("[/api/countries] FAILED:", err.reason || describeError(err));
    res.status(err.status || 502).json({
      error: "Could not load the country list right now. Please try again shortly.",
      reason: err.reason || describeError(err),
    });
  }
});

// GET /api/countries/:code - full details for one country (alpha-2 or alpha-3 code)
app.get("/api/countries/:code", async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();

  if (!/^[A-Z]{2,3}$/.test(code)) {
    return res.status(400).json({ error: "Invalid country code." });
  }

  const cacheKey = `country:${code}`;
  try {
    let country = getCached(cacheKey);
    let state = "HIT";
    if (!country) {
      state = "MISS";
      const raw = await fetchJSON(`${API_BASE}/alpha/${code}`);
      const item = Array.isArray(raw) ? raw[0] : raw;
      if (!item || !item.alpha3Code) {
        const e = new Error("Country not found");
        e.status = 404;
        throw e;
      }
      country = normalizeCountry(item);

      // Resolve border codes to readable names using the (cached) full list.
      let nameByCode = new Map();
      try {
        const { data } = await loadAllCountries();
        nameByCode = new Map(data.map((c) => [c.cca3, c.name.common]));
      } catch { /* names are a nicety - fall back to codes */ }
      country.borderCountries = country.borders.map((b) => ({ code: b, name: nameByCode.get(b) || b }));
      setCached(cacheKey, country);
    }
    res.setHeader("X-Cache", state);
    res.json(country);
  } catch (err) {
    console.error(`[/api/countries/${code}] FAILED:`, err.reason || describeError(err));
    if (err.status === 404) {
      return res.status(404).json({ error: "Country not found." });
    }
    res.status(err.status || 502).json({
      error: "Could not load country details right now. Please try again shortly.",
      reason: err.reason || describeError(err),
    });
  }
});

// Diagnostic: open /api/diagnose to see exactly whether the data source is reachable.
app.get("/api/diagnose", async (req, res) => {
  const started = Date.now();
  try {
    const data = await fetchOnce(`${API_BASE}/alpha/PAK`, HEADER_SETS[1]);
    const item = Array.isArray(data) ? data[0] : data;
    res.json({
      ok: Boolean(item && item.alpha3Code),
      source: API_BASE,
      ms: Date.now() - started,
      node: process.version,
      sample: item ? { name: item.name, alpha3Code: item.alpha3Code, capital: item.capital, population: item.population } : data,
    });
  } catch (err) {
    res.status(502).json({ ok: false, source: API_BASE, ms: Date.now() - started, node: process.version, reason: describeError(err), detail: err.message });
  }
});

// Simple health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---------- Static frontend ----------
app.use(express.static(path.join(__dirname, "..", "public")));

// Fallback 404 for unknown API routes (keep this after static so real files win)
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

module.exports = app;
