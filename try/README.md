# /try/ — TAGRA 30-day trial flow

Conversion-focused signup form for TAGRA 30-day trial. Lives at `tagra.eu/try/` and 5 language variants.

## URL map

```
/try/                EN (default, x-default hreflang)
/try/de/             German
/try/pl/             Polish
/try/cz/             Czech (URL slug "cz", html lang "cs", hreflang "cs")
/try/sk/             Slovak
/try/gr/             Greek (URL slug "gr", html lang "el", hreflang "el")
/try/thanks/         Dynamic thank-you page (single file, JS-routed)
/try/try.js          Audience prefill + form submit handler
```

CSS lives in `/assets/css/main.css` — there is **no** `/try/try.css` (was merged into main.css to keep one source of truth).

## How audience prefill works

The form has 3 audience options: **fleet / driver / enforcement**. Each one drives a different thanks-page variant and download.

Prefill priority (in `try.js`):

1. **`?audience=` URL parameter** wins first. Used by intentional CTA links like `<a href="/try/?audience=driver">` placed on `/driver/` page.
2. **Same-site referrer path** is the fallback. If user arrives without a query param:
   - `document.referrer` matching `/fleet*` → fleet
   - `document.referrer` matching `/driver*` → driver
   - `document.referrer` matching `/enforcement*` → enforcement
   - Allowed hosts: `tagra.eu`, `www.tagra.eu`, `tagra.app`, `www.tagra.app`, `*.netlify.app`
   - Cross-site referrers ignored (anti-spoofing)
3. **No prefill** if neither matches — user picks manually.

## How language switching works

All language pages share **EN nav and EN footer** (same pattern as `enforcement/de/`, `enforcement/pl/`, `enforcement/gr/`). Only the content section (hero, form labels, audience picker, GDPR notice) is localized.

The `<html lang="..">` attribute uses correct ISO 639-1 codes (`cs` for Czech, `el` for Greek), even though URL slugs use `/cz/` and `/gr/` for user familiarity.

## Form submission

Form uses **Netlify Forms** (build-time form detection). Required setup in Netlify dashboard:
- Forms section → "Enable form detection" must be ON
- Form name: `tagra-trial`
- Notifications: configure email to `obchod@tdt.cz` in Settings → Notifications

The hidden duplicate form (`<form name="tagra-trial" hidden>` at top) exists so Netlify's build crawler can detect all fields including dynamic ones. The visible form is what users actually submit.

### Submit flow

1. User fills visible form, clicks submit
2. `try.js` validates HTML5 fields, stores audience + lang in `sessionStorage`
3. Form POSTs to `/try/thanks/` (no query string)
4. Netlify intercepts POST, stores submission, redirects to `/try/thanks/`
5. Thanks page JS reads `sessionStorage` → routes to correct variant:
   - **fleet** → "Your TAGRA trial is ready" + download `TAGRA_eu.zip` (156 MB)
   - **driver** → "Your TAGRA TRUCKER trial is ready" + download `Trucker.zip` (153 MB)
   - **enforcement** → "Request received" + no download, contact-us message

The download files live on `www.tdt.cz/download/` (out of scope for this repo).

## i18n source

All strings live in `/home/claude/tagra-build/i18n.json` (locally — not in repo). 56 keys × 6 langs.

The builder `build.py` generates 6 HTML pages from the same template + i18n data. Re-run when changing copy:

```bash
cd /home/claude/tagra-build && python3 build.py
```

Outputs to `/home/claude/tagra-build/out/try/*` — copy those files to repo paths.

## Country options

Country `<select>` has 31 options + "Other": all EU + Norway, Switzerland, UK. Labels localized per language in `build.py`'s `COUNTRY_LABELS` dict.

## SEO posture

- `<meta name="robots" content="noindex,follow">` — intentional. Trial signup is a conversion page; don't want it competing with `/fleet/` etc. in SERPs. Follow lets link equity pass through.
- Pages NOT in `sitemap.xml` (also intentional)
- Full hreflang alternates (en, de, pl, cs, sk, el, x-default) on every variant
- OG tags with localized title/description/locale

## When DE/PL/CZ/SK content pages don't exist

The nav-lang switcher on `/fleet/` etc. links to `/fleet/de/` even though `fleet/de/index.html` doesn't exist in the repo. `_redirects` handles this:

```
/fleet/de/    /fleet/   302
/driver/de/   /driver/  302
... (etc., wildcard rules for nested)
```

When a real DE/PL version ships, the file wins over the redirect (Netlify processes files before `_redirects`).

## Future work

- **MailKit integration** (deferred until domain settled — `tagra.eu` vs `tagra.app` TBD)
- **Trial-list segmentation** — when MailKit ready: `TAGRA-trial-EN-fleet`, `-driver`, etc.
- **DE/PL content pages** for `/fleet/`, `/driver/`, `/articles/` — currently EN-only

## Files in this directory

```
index.html           EN trial form
de/index.html        DE trial form
pl/index.html        PL trial form
cz/index.html        CZ trial form
sk/index.html        SK trial form
gr/index.html        GR trial form
thanks/index.html    Dynamic thanks page (i18n + audience router)
try.js               Audience prefill + form submit handler
README.md            This file
```

All HTML files inherit styles from `/assets/css/main.css`, `/assets/css/nav.css`, `/assets/css/footer.css` — no page-specific CSS.

---

Last updated: 12 May 2026 — Vlna 3 rebuild (multilingual, unified CSS, referrer prefill).
