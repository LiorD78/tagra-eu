# Email automation setup — TAGRA trial flow

This document describes the **one-time manual setup** required to enable beautiful HTML emails for trial signups.

## What we built

When a user submits the `/try/` form, three things happen:

1. **Netlify Forms** stores the submission and emails `obchod@tdt.cz` (already working)
2. **Thanks page** (`/try/thanks/`) shows the download button immediately (already working)
3. **NEW: Beautiful HTML email** is sent to the user via Resend.com — branded, localized, with the download link

## What you need to do (manual, ~15 minutes)

### Step 1. Sign up at Resend.com

- Go to [resend.com](https://resend.com) and create a free account
- Free tier: 3,000 emails/month, 100/day — more than enough at current volume

### Step 2. Verify domain `tagra.eu`

In Resend dashboard:
- Domains → Add domain → `tagra.eu`
- Copy the 3 DNS records (SPF, DKIM, return-path)
- Add them in Wedos DNS for `tagra.eu` (currently managed by colleague on separate account — needs DNS access)
- Wait for verification (usually < 1 hour)

### Step 3. Create API key

- API Keys → Create API key
- Name: `tagra-eu-netlify`
- Permission: "Sending access" (limited to the verified domain)
- **Copy the key** (`re_...`) — you only see it once

### Step 4. Add Netlify environment variable

In Netlify dashboard for `tagra-eu`:
- Site settings → Build & deploy → Environment → Environment variables → Edit variables
- Add new variable:
  - Key: `RESEND_API_KEY`
  - Value: `re_xxxxxxxxxxxx...` (the key from step 3)
  - Scope: "Production" and "Deploy previews"
- Optionally add `RESEND_FROM` if you want different "From" address (default: `TAGRA <trials@tagra.eu>`)

### Step 5. Configure Netlify Forms outgoing webhook

- Site settings → Forms → Form notifications → Add notification
- Type: **Outgoing webhook**
- Event: **New form submission**
- Form: **tagra-trial**
- URL: `https://tagra.eu/.netlify/functions/trial-email`
- Save

### Step 6. Test

- Open `/try/cz/` (or any lang)
- Fill the form with **your own email** (not a fake one — Resend will refuse fake addresses)
- Submit
- Within ~10 seconds you should receive a beautifully designed CZ email with the download link

If something fails:
- Check Netlify dashboard → Functions → trial-email → Logs (last 7 days)
- Check Resend dashboard → Logs → recent activity

## Architecture

```
User submits /try/cz/ form
     ↓
Netlify Forms captures submission
     ↓ (1) email obchod@tdt.cz   ─→  Libor reviews lead
     ↓ (2) outgoing webhook
     ↓
/.netlify/functions/trial-email
     ↓
Fetch /try/email-preview/cz-fleet.html (or matching variant)
     ↓
Substitute {NAME} placeholder
     ↓
POST to Resend API
     ↓
User receives HTML email with download link
```

## Templates

18 templates live at `/try/email-preview/{lang}-{audience}.html`:

| | fleet | driver | enforcement |
|---|---|---|---|
| EN | ✓ | ✓ | ✓ |
| DE | ✓ | ✓ | ✓ |
| PL | ✓ | ✓ | ✓ |
| CZ | ✓ | ✓ | ✓ |
| SK | ✓ | ✓ | ✓ |
| GR | ✓ | ✓ | ✓ |

Preview at `https://tagra.eu/try/email-preview/` (noindex, won't show in SERPs).

Templates have placeholder `{NAME}` which the function substitutes with the user's first name at runtime.

## To edit a template

1. Edit `/home/claude/tagra-email/build-emails.py` (i18n strings) or `/home/claude/tagra-email/template.html` (structure)
2. Run `python3 build-emails.py` to regenerate all 18
3. Copy `out/{lang}/{audience}.html` → repo path `try/email-preview/{lang}-{audience}.html`
4. Commit & push — auto-deploys to Netlify
5. The function fetches fresh template on every invocation (no need to redeploy function)

## MailKit list integration (Phase 4.5 — later)

Currently this only sends the welcome email — it does NOT auto-add the user to MailKit lists.

**Why deferred**: MailKit JSON-RPC requires IP whitelist, and Netlify Functions have dynamic egress IPs. Solutions are:

1. **Cloudflare Worker proxy** with a static IP — adds 1 hop, complexity
2. **Direct MailKit REST API** (if available, no IP whitelist) — needs to be checked
3. **CSV export workflow** (current): weekly export from Netlify Forms dashboard, import to MailKit segmented by audience+lang

For now, do option 3 manually until volume justifies the proxy. List IDs to use:

- TAGRA-trial-EN-fleet, EN-driver, EN-enforcement (create new)
- TAGRA-trial-DE-fleet, DE-driver, DE-enforcement (create new)
- TAGRA-trial-PL-fleet, PL-driver, PL-enforcement (create new)
- CZ/SK → use existing TDT 4/2026 list (id 128720) with custom field `source=tagra-trial-CZ` or `-SK`

## Cost & limits

- **Resend free tier**: 3,000 emails/month, 100/day → sufficient until ~100 signups/day
- **Resend paid tier**: $20/month for 50,000 emails — switch when needed
- **Netlify Functions**: 125k invocations/month included in free tier, more than enough
- **Function timeout**: 10 seconds default — we're well under (1-2s typical)

## GDPR compliance

The form already collects GDPR consent (`gdpr_consent=yes` required to submit). The email is **transactional** (user requested it by submitting the form), so it doesn't fall under marketing consent rules. Still, the email footer mentions "you received this because you requested a TAGRA trial" — clear context.

For marketing follow-ups (drip campaign in MailKit), you must use **double-opt-in** — separate flow, not yet implemented.
