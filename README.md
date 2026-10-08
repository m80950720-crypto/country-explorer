# 🌍 Country Explorer

A modern, responsive website to search, filter, and explore countries around
the world — built with **HTML + Tailwind CSS v3**, a **Node.js/Express**
backend, and the free [REST Countries API](https://restcountries.com) (no API
key required).

## Features

- 🔍 Live search by country name
- 🌎 Filter by region (Africa, Americas, Asia, Europe, Oceania, Antarctic)
- 🗂️ Card grid with flag, population, region, and capital
- 📄 Dedicated details page (population, subregion, languages, currencies, bordering countries)
- 🌓 Dark / light mode toggle, saved in `localStorage`, using Tailwind's `class` dark mode strategy
- ⚡ Server-side in-memory caching of API responses
- 📱 Fully responsive, mobile-first layout

## Project structure

```
country-explorer/
├── public/                 # static frontend
│   ├── index.html            # home page (search, filter, cards)
│   ├── country.html           # details page
│   ├── css/output.css          # compiled Tailwind CSS
│   └── js/
│       ├── theme-init.js         # runs in <head>, avoids flash of wrong theme
│       ├── theme-toggle.js       # wires up the dark/light toggle button
│       ├── app.js                 # home page logic (fetch, search, filter, render)
│       └── country.js             # details page logic
├── lib/app.js               # shared Express app (routes + static serving)
├── server.js                 # local dev entry point (calls app.listen)
├── api/index.js                # Vercel serverless entry point (same app)
├── vercel.json                  # routes all traffic through api/index.js
├── tailwind.config.js
├── src/input.css              # Tailwind source file
├── package.json
└── .gitignore
```

`server.js` and `api/index.js` both import the **same** Express app from
`lib/app.js`, so local development and the Vercel deployment behave
identically — there's only one copy of the routing logic to maintain.

## API routes

| Route | Description |
|---|---|
| `GET /api/countries` | All countries, using `restcountries.com/v3.1/all?fields=name,cca3,flags,population,region,capital` |
| `GET /api/countries/:code` | Full details for one country via `restcountries.com/v3.1/alpha/{code}` |
| `GET /api/health` | Simple health check |

Both routes cache upstream responses in memory for 10 minutes to reduce
repeat calls to restcountries.com.

> **Note on caching in serverless environments:** on Vercel, each function
> invocation may run on a fresh instance, so the in-memory cache mainly helps
> warm instances and local development. It still meaningfully reduces calls
> on a running server.

### Why requests to restcountries.com need custom headers

`restcountries.com` sits behind Cloudflare, which can silently block or
challenge requests that don't look like they came from a real client - this
is a well-documented cause of "works perfectly on localhost, fails silently
once deployed" for this specific API. `lib/app.js` sends an explicit
`User-Agent` and `Accept` header on every upstream request, plus a timeout
and one automatic retry, which resolves this in the vast majority of cases.

If you ever see "Couldn't load countries" again after deploying, check your
**Vercel → Project → Logs** - the upstream status code and response snippet
are logged there (e.g. `Upstream request failed (403): ...`), which tells you
exactly what restcountries.com sent back.

### Troubleshooting "Couldn't load countries" locally

If this happens on `npm start` (before you've even deployed), look at your
**terminal**, not the browser - the real error is printed there, for example:

```
[startup] Node.js v16.20.0 | global fetch available: false
[/api/countries] FAILED: TypeError - fetchImpl is not a function
```

Common causes, in order of likelihood:

1. **Node.js version below 18.** Run `node -v`. If it's lower than 18, either
   upgrade Node (recommended - download from https://nodejs.org), or make
   sure `npm install` completed successfully so the `node-fetch` fallback
   this project ships with is available.
2. **A firewall, VPN, or antivirus is blocking outbound HTTPS requests.**
   Try opening `https://restcountries.com/v3.1/all?fields=name` directly in
   your browser - if that also fails to load, the issue is your network, not
   this code.
3. **`npm install` wasn't run, or failed partway.** Delete `node_modules`
   and run `npm install` again, watching for any red error text.

Whatever error text appears in your terminal after these changes will say
exactly which of these it is.

## Running locally

```bash
npm install
npm start
```

Open **http://localhost:3000**.

For development with auto-restart on file changes:

```bash
npm run dev
```

## Working with Tailwind CSS

This repo ships with a pre-built `public/css/output.css` so the site works
immediately with no build step. If you change `src/input.css`,
`tailwind.config.js`, or add new utility classes in the HTML, rebuild the
compiled CSS:

```bash
npm run build:css
```

Or watch for changes while you work:

```bash
npm run watch:css
```

## Deploying to Vercel

This project is ready to deploy as-is — no dashboard configuration needed.

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), click **Add New → Project** and import
   the repository.
3. Leave all settings on their defaults and click **Deploy**.

Vercel will read `vercel.json`, which routes every request (both page loads
and `/api/*` calls) through `api/index.js` — the same Express app used
locally. The `includeFiles` setting in `vercel.json` ensures the `public/`
folder is bundled with the serverless function so static assets are served
correctly.

### Deploying via CLI (alternative)

```bash
npm install -g vercel
vercel login
vercel --prod
```

## Dark mode implementation

- `tailwind.config.js` sets `darkMode: "class"`.
- `public/js/theme-init.js` is loaded in `<head>` (before the page renders)
  and immediately applies the `dark` class to `<html>` based on the saved
  `localStorage` preference, or the OS preference if nothing is saved yet —
  this avoids a flash of the wrong theme.
- `public/js/theme-toggle.js` wires up the navbar button: it toggles the
  `dark` class and persists the choice to `localStorage`.

## Tech stack

- **Frontend:** HTML, Tailwind CSS v3 (CLI), vanilla JavaScript
- **Backend:** Node.js, Express
- **Data:** [REST Countries API](https://restcountries.com) v3.1 (free, no key)
- **Hosting:** Vercel (serverless functions + static files)

## Troubleshooting "Couldn't load countries"

1. Open `http://localhost:3000/api/diagnose` - it tells you exactly why restcountries.com is (un)reachable
   (timeout, DNS, firewall/antivirus TLS interception, HTTP 403...).
2. The error screen also prints a `Reason:` line under the message.
3. Requires Node 18+ (Node 20/22/24 all fine).

## Data source (important)

`restcountries.com` v1-v4 were shut down in 2026 (v5 requires an account and an API key).
This project now uses **countries.dev** (free, no key, no `.env`). The Express backend
normalises its responses, so the frontend is unchanged. If you prefer REST Countries v5,
only `lib/app.js` (API_BASE + normalizeCountry) needs to change.
