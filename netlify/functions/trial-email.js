/**
 * Netlify Function: trial-email
 *
 * Triggered by Netlify Forms submission webhook (form: "tagra-trial").
 * Sends a beautifully designed transactional email to the trial user via Resend.com.
 *
 * Configuration:
 *   - Resend API key in env var RESEND_API_KEY
 *   - From address: trials@tagra.eu (needs DNS verification on tagra.eu)
 *
 * Setup steps (manual, one-time):
 *   1. Sign up at https://resend.com (free tier 3,000 emails/month)
 *   2. Add domain tagra.eu, copy DNS records to Wedos
 *   3. Wait for verification
 *   4. Create API key, paste into Netlify env vars as RESEND_API_KEY
 *   5. Configure Netlify form notification:
 *      Settings → Forms → "Outgoing webhook" → URL:
 *      https://tagra.eu/.netlify/functions/trial-email
 *      Event: "Submission created"
 *      Form: "tagra-trial"
 *
 * Template loading:
 *   Templates live in repo at /try/email-preview/{lang}-{audience}.html.
 *   We fetch them at runtime via HTTPS (same Netlify deploy) and substitute {NAME}.
 *
 * Fallback:
 *   If Resend fails or env not set, function logs error and returns 200 so Netlify
 *   doesn't retry endlessly. User still got Netlify Forms thank-you + admin notification.
 */

const RESEND_API = "https://api.resend.com/emails";
const TEMPLATE_BASE = "https://tagra.eu/try/email-preview";

const LANG_TO_HTML = {
  en: "en", de: "de", pl: "pl", cz: "cz", sk: "sk", gr: "gr",
};
const VALID_AUDIENCES = ["fleet", "driver", "enforcement"];

// Subject lines per (lang, audience) — extracted from templates' <title>
const SUBJECTS = {
  en: {
    fleet:       "Your TAGRA trial is ready — Download inside",
    driver:      "Your TAGRA TRUCKER trial is ready — Download inside",
    enforcement: "Thank you for your interest in TAGRA Control",
  },
  de: {
    fleet:       "Ihre TAGRA-Testversion ist bereit — Download im Inneren",
    driver:      "Ihre TAGRA TRUCKER-Testversion ist bereit — Download im Inneren",
    enforcement: "Vielen Dank für Ihr Interesse an TAGRA Control",
  },
  pl: {
    fleet:       "Wersja próbna TAGRA jest gotowa — link do pobrania w środku",
    driver:      "Wersja próbna TAGRA TRUCKER jest gotowa — link w środku",
    enforcement: "Dziękujemy za zainteresowanie TAGRA Control",
  },
  cz: {
    fleet:       "Vaše zkušební verze TAGRA je připravena — odkaz ke stažení uvnitř",
    driver:      "Vaše zkušební verze TAGRA TRUCKER je připravena — odkaz uvnitř",
    enforcement: "Děkujeme za Váš zájem o TAGRA Control",
  },
  sk: {
    fleet:       "Vaša skúšobná verzia TAGRA je pripravená — odkaz na stiahnutie vo vnútri",
    driver:      "Vaša skúšobná verzia TAGRA TRUCKER je pripravená — odkaz vo vnútri",
    enforcement: "Ďakujeme za Váš záujem o TAGRA Control",
  },
  gr: {
    fleet:       "Η δοκιμαστική έκδοση TAGRA είναι έτοιμη — σύνδεσμος λήψης εντός",
    driver:      "Η δοκιμαστική έκδοση TAGRA TRUCKER είναι έτοιμη — σύνδεσμος εντός",
    enforcement: "Σας ευχαριστούμε για το ενδιαφέρον σας για το TAGRA Control",
  },
};

function logInfo(msg, extra) {
  console.log(`[trial-email] ${msg}`, extra || "");
}

function logError(msg, extra) {
  console.error(`[trial-email] ERROR: ${msg}`, extra || "");
}

/**
 * Extract first name for personalized greeting.
 * "John Smith" → "John", "Anna" → "Anna", "" → "there"
 */
function firstName(fullName) {
  if (!fullName || typeof fullName !== "string") return "there";
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

exports.handler = async (event) => {
  // Only POST allowed
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Parse Netlify form submission webhook payload
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    logError("Invalid JSON in webhook body");
    return { statusCode: 200, body: "Ignored: invalid JSON" };
  }

  // Netlify forms webhook payload structure:
  //   { form_name: "tagra-trial", data: { name, email, audience, language, ... } }
  const data = payload.data || payload.payload || payload || {};
  const formName = payload.form_name || data.form_name || "(unknown)";

  if (formName !== "tagra-trial") {
    logInfo(`Ignored form: ${formName}`);
    return { statusCode: 200, body: "Ignored: not tagra-trial" };
  }

  // Extract fields
  const email    = (data.email || "").trim();
  const name     = (data.name || "").trim();
  const audience = (data.audience || "fleet").toLowerCase();
  const language = (data.language || "en").toLowerCase();

  if (!email) {
    logError("Missing email in submission");
    return { statusCode: 200, body: "Ignored: no email" };
  }

  // Validate audience + lang
  const finalAudience = VALID_AUDIENCES.includes(audience) ? audience : "fleet";
  const finalLang     = LANG_TO_HTML[language] ? language : "en";

  // Env check
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logError("RESEND_API_KEY not configured — skipping email send");
    return { statusCode: 200, body: "Configured: no API key" };
  }

  // Fetch the HTML template for this lang+audience
  const templateUrl = `${TEMPLATE_BASE}/${finalLang}-${finalAudience}.html`;
  let templateHtml;
  try {
    const r = await fetch(templateUrl);
    if (!r.ok) {
      logError(`Template fetch failed: ${r.status} ${templateUrl}`);
      return { statusCode: 200, body: "Template unavailable" };
    }
    templateHtml = await r.text();
  } catch (e) {
    logError(`Template fetch error: ${e.message}`);
    return { statusCode: 200, body: "Template fetch error" };
  }

  // Substitute {NAME} placeholder with the user's first name
  const greeting = firstName(name);
  const finalHtml = templateHtml.replaceAll("{NAME}", greeting);

  const subject = (SUBJECTS[finalLang] && SUBJECTS[finalLang][finalAudience])
    || SUBJECTS.en[finalAudience];

  // Send via Resend
  const fromAddr = process.env.RESEND_FROM || "TAGRA <trials@tagra.eu>";
  const replyTo  = "obchod@tdt.cz";

  try {
    const resp = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [email],
        reply_to: replyTo,
        subject: subject,
        html: finalHtml,
        // Track engagement (opens, clicks) — Resend handles this if enabled in dashboard
        tags: [
          { name: "campaign", value: "trial-signup" },
          { name: "audience", value: finalAudience },
          { name: "language", value: finalLang },
        ],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      logError(`Resend API ${resp.status}: ${errBody}`);
      return { statusCode: 200, body: `Send failed: ${resp.status}` };
    }

    const result = await resp.json();
    logInfo(`Email sent to ${email} (lang=${finalLang}, audience=${finalAudience}, resendId=${result.id})`);

    return {
      statusCode: 200,
      body: JSON.stringify({ sent: true, id: result.id }),
    };

  } catch (e) {
    logError(`Resend fetch error: ${e.message}`);
    return { statusCode: 200, body: "Send error" };
  }
};
