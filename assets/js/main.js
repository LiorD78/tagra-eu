// TAGRA.EU — Main JS
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(a.getAttribute('href'));
    if(t) t.scrollIntoView({ behavior: 'smooth' });
  });
});
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    const suffix = el.dataset.suf || '';
    let cur = 0, step = target / 60;
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = Math.floor(cur).toLocaleString() + suffix;
      if(cur >= target) clearInterval(t);
    }, 16);
  });
}
const statsEl = document.querySelector('.stats');
if(statsEl) new IntersectionObserver(e => { if(e[0].isIntersecting) animateCounters(); }, {threshold: 0.5}).observe(statsEl);
