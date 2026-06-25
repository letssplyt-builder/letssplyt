import './styles.css';

const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

const header = document.querySelector('.site-header');
const revealEls = document.querySelectorAll('.reveal');

const onScroll = (): void => {
  if (header) {
    header.classList.toggle('scrolled', window.scrollY > 24);
  }
};

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
);

for (const el of revealEls) {
  revealObserver.observe(el);
}

const navLinks = document.querySelectorAll('.nav a, .header-cta');
for (const link of navLinks) {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href?.startsWith('#')) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
}
