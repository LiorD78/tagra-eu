/* TAGRA shared nav behavior — loaded site-wide alongside nav.css.
   Currently handles: click-outside-to-close on the <details class="nav-lang"> dropdown. */
(function() {
  'use strict';
  document.addEventListener('click', function(e) {
    document.querySelectorAll('details.nav-lang[open]').forEach(function(el) {
      if (!el.contains(e.target)) {
        el.removeAttribute('open');
      }
    });
  });
  // Also close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      document.querySelectorAll('details.nav-lang[open]').forEach(function(el) {
        el.removeAttribute('open');
        // Return focus to the summary so keyboard users don't lose context
        var sum = el.querySelector('summary');
        if (sum) sum.focus();
      });
    }
  });
})();
