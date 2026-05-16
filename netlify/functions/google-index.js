'use strict';

/**
 * google-index — Netlify Function pro Google Indexing API.
 *
 * POST endpoint, body: { url, type? }
 *   url    — must start with http:// or https://
 *   type   — 'URL_UPDATED' (default) | 'URL_DELETED'
 *
 * Flow:
 *   1. Load SA JSON from env GOOGLE_SA_KEY_B64 (base64 → utf8 → JSON.parse).
 *   2. Mint JWT RS256 (iss=client_email, scope=indexing, aud=token endpoint).
 *   3. Exchange JWT za access_token na oauth2.googleapis.com/token
 *      (cached in-memory s 10 min margin před expiry → warm Lambda reuse).
 *   4. POST urlNotifications:publish s Bearer auth + body.
 *   5. Vrátí pass-through Google status + structured response.
 *
 * Errors → 500 { error, timestamp }.
 */

const jwt = require('jsonwebtoken');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const INDEXING_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const SCOPE = 'https://www.googleapis.com/auth/indexing';
const TOKEN_REFRESH_MARGIN_S = 600; // 10 min — refresh dřív než cache expiry

// Module-scoped cache — survives warm Lambda invocations. Cold start = fresh exchange.
let cachedToken = null; // { token: string, expiresAt: number (unix seconds) }

function loadServiceAccount() {
  const b64 = process.env.GOOGLE_SA_KEY_B64;
  if (!b64) {
    throw new Error('Missing GOOGLE_SA_KEY_B64 env var');
  }
  let json;
  try {
    json = Buffer.from(b64, 'base64').toString('utf8');
  } catch (e) {
    throw new Error('GOOGLE_SA_KEY_B64 not valid base64');
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error('GOOGLE_SA_KEY_B64 not valid JSON after base64 decode');
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('SA JSON missing client_email or private_key');
  }
  return parsed;
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token pokud zbývá víc než 10 min do expiry.
  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_S > now) {
    return cachedToken.token;
  }

  const claim = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const signed = jwt.sign(claim, sa.private_key, { algorithm: 'RS256' });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signed,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth token exchange failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (typeof data.expires_in === 'number' ? data.expires_in : 3600),
  };
  return cachedToken.token;
}

exports.handler = async (event) => {
  const timestamp = new Date().toISOString();

  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed', timestamp }),
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body', timestamp }),
      };
    }

    const url = body.url;
    const type = body.type || 'URL_UPDATED';

    if (!url || typeof url !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing url in body', timestamp }),
      };
    }
    if (!/^https?:\/\//.test(url)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'url must start with http:// or https://',
          timestamp,
        }),
      };
    }
    if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'type must be URL_UPDATED or URL_DELETED',
          timestamp,
        }),
      };
    }

    const sa = loadServiceAccount();
    const accessToken = await getAccessToken(sa);

    const googleRes = await fetch(INDEXING_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type }),
    });

    let googleBody;
    const contentType = googleRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        googleBody = await googleRes.json();
      } catch (e) {
        googleBody = { parse_error: 'Failed to parse Google JSON response' };
      }
    } else {
      googleBody = await googleRes.text();
    }

    return {
      statusCode: googleRes.ok ? 200 : googleRes.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        type,
        google_status: googleRes.status,
        google_response: googleBody,
        timestamp,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: err && err.message ? err.message : String(err),
        timestamp,
      }),
    };
  }
};
