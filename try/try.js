/* TAGRA.EU /try/ — Trial form JS
 *
 * Responsibilities:
 * 1. Prefill `audience` radio based on ?audience= URL param (so CTA from /fleet/ pre-selects "fleet")
 * 2. Set hidden `source_url` field for analytics/debugging
 * 3. Mobile nav toggle (shared with rest of site)
 * 4. Loading state on submit button (Netlify handles the actual submission)
 * 5. Light HTML5 validation feedback (no JS validation — trust browser + Netlify)
 */

(function () {
  'use strict';

  // ─── 1. Audience prefill from ?audience= ───
  const params = new URLSearchParams(window.location.search);
  const audience = params.get('audience');
  if (audience && ['fleet', 'driver', 'enforcement'].includes(audience)) {
    const radio = document.querySelector(`input[name="audience"][value="${audience}"]`);
    if (radio) radio.checked = true;
  }

  // ─── 2. Source URL tracking ───
  const sourceUrl = document.getElementById('source_url');
  if (sourceUrl) {
    // Include referrer + current path, so admin notification email shows where the lead came from
    const ref = document.referrer || '(direct)';
    sourceUrl.value = `${ref} → ${window.location.href}`;
  }

  // ─── 3. Mobile nav toggle (matches rest of site) ───
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // ─── 4. Loading state on submit ───
  const form = document.getElementById('trialForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    // Let Netlify handle validation + submission naturally
    // We only switch button to loading state if browser validation passes
    if (!form.checkValidity()) {
      // Find first invalid field and scroll to it
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) {
        firstInvalid.closest('.form-field, .audience-picker, .gdpr-check')?.classList.add('has-error');
        firstInvalid.focus({ preventScroll: false });
      }
      return;
    }

    const btn = form.querySelector('.btn-submit');
    const btnText = btn?.querySelector('.btn-text');
    const btnLoading = btn?.querySelector('.btn-loading');
    if (btn && btnText && btnLoading) {
      btn.disabled = true;
      btnText.hidden = true;
      btnLoading.hidden = false;
    }
    // Carry audience + language into the thanks page via URL
    // Netlify's POST handler will follow `action="/try/thanks/"` with redirect=true,
    // but to pass our metadata we override action with query string
    const audience = form.querySelector('input[name="audience"]:checked')?.value || 'fleet';
    const language = form.querySelector('input[name="language"]')?.value || 'en';
    const baseAction = '/try/thanks/';
    form.action = `${baseAction}?audience=${audience}&lang=${language}`;
  });

  // ─── 5. Clear has-error on input ───
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    el.addEventListener('input', () => {
      el.closest('.form-field, .audience-picker, .gdpr-check')?.classList.remove('has-error');
    });
    el.addEventListener('change', () => {
      el.closest('.form-field, .audience-picker, .gdpr-check')?.classList.remove('has-error');
    });
  });
})();
