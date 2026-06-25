import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../../backend/public');

const LEGAL_LOGO_MARK = `<span class="logo-mark" aria-hidden="true">
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="9" fill="url(#logoGrad)" />
    <path
      d="M9 16.5c0-2.5 1.8-4.5 4.2-4.9V8.5h2.4v3.1c2.4.4 4.2 2.4 4.2 4.9s-1.8 4.5-4.2 4.9v3.1h-2.4v-3.1C10.8 21 9 19 9 16.5Z"
      fill="white"
      fill-opacity="0.95"
    />
    <defs>
      <linearGradient id="logoGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stop-color="#0E5C66" />
        <stop offset="1" stop-color="#1A8F9E" />
      </linearGradient>
    </defs>
  </svg>
</span>`;

function legalFooterHtml(year = new Date().getFullYear()) {
  return `
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <span class="logo-text">LetsSplyt</span>
        <p>Split bills without the friction.</p>
      </div>
      <nav class="footer-nav" aria-label="Footer">
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
      </nav>
      <div class="footer-meta">
        <p class="footer-contact">Contact us at <strong>builder@letssplyt.com</strong></p>
        <p class="footer-copy">&copy; ${year} LetsSplyt. All rights reserved.</p>
      </div>
    </div>
  </footer>`;
}

function legalHeaderHtml(active) {
  const privacyCurrent = active === 'privacy' ? ' aria-current="page"' : '';
  const termsCurrent = active === 'terms' ? ' aria-current="page"' : '';

  return `
  <header class="site-header legal-site-header" id="top">
    <div class="container header-inner">
      <a class="logo" href="/" aria-label="LetsSplyt home">
        ${LEGAL_LOGO_MARK}
        <span class="logo-text">LetsSplyt</span>
      </a>
      <nav class="nav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/terms.html"${termsCurrent}>Terms</a>
        <a href="/privacy.html"${privacyCurrent}>Privacy</a>
      </nav>
    </div>
  </header>`;
}

function legalHeadHtml(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — LetsSplyt</title>
  <meta name="theme-color" content="#0B3D45">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
  <link rel="stylesheet" href="/legal.css" />
</head>
<body class="legal-page">`;
}

const pages = [
  {
    file: 'privacy.html',
    active: 'privacy',
    title: 'Privacy Policy',
    heroTitle: 'Privacy Policy',
    bodyMarker: '<h2>1. Introduction</h2>',
  },
  {
    file: 'terms.html',
    active: 'terms',
    title: 'Terms of Service',
    heroTitle: 'Terms of Service',
    bodyMarker: '<blockquote>',
  },
];

function extractBodyContent(existing, page) {
  const assembledMarker = '<article class="legal-card legal-content">';
  const assembledIndex = existing.indexOf(assembledMarker);
  if (assembledIndex !== -1) {
    const contentStart = assembledIndex + assembledMarker.length;
    const articleEnd = existing.indexOf('</article>', contentStart);
    if (articleEnd === -1) {
      throw new Error(`</article> not found in ${page.file}`);
    }
    return existing.slice(contentStart, articleEnd).trim();
  }

  const markerIndex = existing.indexOf(page.bodyMarker);
  if (markerIndex === -1) {
    throw new Error(`Body marker not found in ${page.file}`);
  }

  const bodyEnd = existing.indexOf('</main>');
  if (bodyEnd === -1) {
    throw new Error(`</main> not found in ${page.file}`);
  }

  return existing.slice(markerIndex, bodyEnd).trim();
}

for (const page of pages) {
  const filePath = path.join(publicDir, page.file);
  const existing = fs.readFileSync(filePath, 'utf8');

  let bodyContent = extractBodyContent(existing, page);
  bodyContent = bodyContent.replace(
    'https://letssplyt.com/legal/privacy',
    '/privacy.html',
  );

  const html = [
    legalHeadHtml(page.title),
    legalHeaderHtml(page.active),
    `<div class="legal-hero">
    <div class="container">
      <p class="legal-hero-eyebrow">Legal</p>
      <h1>${page.heroTitle}</h1>
      <p class="legal-hero-meta"><strong>Effective:</strong> June 7, 2026 · <strong>Last updated:</strong> June 7, 2026</p>
    </div>
  </div>
  <main class="legal-main">
    <div class="container">
      <article class="legal-card legal-content">`,
    bodyContent,
    `      </article>
    </div>
  </main>`,
    legalFooterHtml(),
    `</body>
</html>
`,
  ].join('\n');

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`assembled ${page.file}`);
}
