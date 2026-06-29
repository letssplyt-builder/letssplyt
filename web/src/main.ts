import './styles.css';

const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

const header = document.querySelector<HTMLElement>('.site-header');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function onScroll(): void {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 24);
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

if (!prefersReducedMotion) {
  const revealEls = document.querySelectorAll<HTMLElement>('.reveal');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  revealEls.forEach((el) => observer.observe(el));

  const chaosFeed = document.querySelector<HTMLElement>('.chaos-feed');
  if (chaosFeed) {
    const chaosObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            chaosFeed.classList.add('chaos-live');
            chaosObserver.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    chaosObserver.observe(chaosFeed);
  }
} else {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  document.querySelectorAll('.chaos-feed').forEach((el) => el.classList.add('chaos-live'));
}

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });
});
