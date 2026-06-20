import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../');
const outDir = path.join(root, 'mobile/src/content/legal');

const LEGAL_DATE = 'June 7, 2026';
const DATE_PLACEHOLDER = /\[INSERT DATE BEFORE PUBLISHING\]/g;

function prepareMarkdown(sourceRelativePath) {
  const raw = fs.readFileSync(path.join(root, sourceRelativePath), 'utf8');
  return raw.replace(DATE_PLACEHOLDER, LEGAL_DATE);
}

function prepareMarkdownForHtml(sourceRelativePath) {
  return prepareMarkdown(sourceRelativePath).replace(/\s*\{#[^}]+\}/g, '');
}

const LEGAL_HTML_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #F2F2F7;
    color: #1a1a2e;
    line-height: 1.6;
  }
  .legal-nav {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 20px 0;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 14px;
  }
  .legal-nav a {
    color: #0E5C66;
    font-weight: 600;
    text-decoration: none;
  }
  .legal-nav a[aria-current="page"] {
    color: #1a1a2e;
    text-decoration: underline;
  }
  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px 20px 48px;
  }
  .legal-content h1 {
    font-size: 26px;
    font-weight: 800;
    margin-bottom: 12px;
    line-height: 1.25;
  }
  .legal-content h2 {
    font-size: 18px;
    font-weight: 700;
    margin: 28px 0 10px;
    line-height: 1.35;
  }
  .legal-content h3 {
    font-size: 16px;
    font-weight: 700;
    margin: 20px 0 8px;
    line-height: 1.35;
  }
  .legal-content p,
  .legal-content li {
    font-size: 15px;
    color: #374151;
    margin-bottom: 12px;
  }
  .legal-content ul,
  .legal-content ol {
    margin: 0 0 12px 20px;
  }
  .legal-content strong { color: #111827; }
  .legal-content a { color: #0E5C66; }
  .legal-content blockquote {
    border-left: 3px solid #A5D8E0;
    background: #F9FAFB;
    border-radius: 0 12px 12px 0;
    padding: 12px 14px;
    margin: 12px 0;
    color: #4B5563;
    font-size: 14px;
  }
  .legal-content hr {
    border: none;
    border-top: 1px solid #E5E7EB;
    margin: 24px 0;
  }
  .legal-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px;
    font-size: 14px;
  }
  .legal-content th,
  .legal-content td {
    border: 1px solid #E5E7EB;
    padding: 10px;
    text-align: left;
    vertical-align: top;
  }
  .legal-content th {
    background: #F3F4F6;
    font-weight: 700;
    color: #111827;
  }
  .legal-footer {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 20px 40px;
    font-size: 13px;
    color: #6B7280;
  }
  .legal-footer a { color: #0E5C66; font-weight: 600; }
`;

function renderLegalHtmlPage({ title, bodyHtml, currentPath, sibling }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — LetsSplyt</title>
  <style>${LEGAL_HTML_STYLES}</style>
</head>
<body>
  <nav class="legal-nav" aria-label="Legal documents">
    <a href="/terms.html"${currentPath === '/terms.html' ? ' aria-current="page"' : ''}>Terms of Service</a>
    <a href="/privacy.html"${currentPath === '/privacy.html' ? ' aria-current="page"' : ''}>Privacy Policy</a>
  </nav>
  <main class="page legal-content">
    ${bodyHtml}
  </main>
  <footer class="legal-footer">
    See also: <a href="${sibling.href}">${sibling.label}</a>
  </footer>
</body>
</html>
`;
}

function writeLegalHtmlPage(fileName, title, sourceRelativePath, sibling) {
  const markdown = prepareMarkdownForHtml(sourceRelativePath);
  const bodyHtml = marked.parse(markdown, { async: false, gfm: true, breaks: true });
  const currentPath = `/${fileName}`;
  const html = renderLegalHtmlPage({ title, bodyHtml, currentPath, sibling });
  const publicDir = path.join(root, 'backend/public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, fileName), html);
}

function tokensToSections(tokens) {
  const sections = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        if (token.depth === 1) sections.push({ type: 'h1', text: token.text });
        else if (token.depth === 2) sections.push({ type: 'h2', text: token.text });
        else sections.push({ type: 'h3', text: token.text });
        break;
      case 'paragraph':
        sections.push({ type: 'p', text: token.text });
        break;
      case 'blockquote':
        sections.push({ type: 'blockquote', text: token.text });
        break;
      case 'list':
        sections.push({
          type: 'ul',
          items: token.items.map((item) => item.text),
        });
        break;
      case 'table':
        sections.push({
          type: 'table',
          headers: token.header.map((cell) => cell.text),
          rows: token.rows.map((row) => row.map((cell) => cell.text)),
        });
        break;
      case 'hr':
        sections.push({ type: 'hr' });
        break;
      default:
        break;
    }
  }

  return sections;
}

function writeSectionsModule(fileName, exportName, sourceRelativePath) {
  const markdown = prepareMarkdown(sourceRelativePath);
  const sections = tokensToSections(marked.lexer(markdown));
  fs.writeFileSync(
    path.join(outDir, fileName),
    `import type { LegalSection } from './legal.types';\n\nexport const ${exportName}: LegalSection[] = ${JSON.stringify(sections, null, 2)};\n`,
  );
}

function syncSourceMarkdownDates(sourceRelativePath) {
  const filePath = path.join(root, sourceRelativePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const updated = raw.replace(DATE_PLACEHOLDER, LEGAL_DATE);
  if (updated !== raw) {
    fs.writeFileSync(filePath, updated);
  }
}

fs.mkdirSync(outDir, { recursive: true });
syncSourceMarkdownDates('docs/LetsSplyt-Terms-of-Service.md');
syncSourceMarkdownDates('docs/LetsSplyt-Privacy-Policy.md');
writeSectionsModule('termsOfServiceSections.ts', 'TERMS_SECTIONS', 'docs/LetsSplyt-Terms-of-Service.md');
writeSectionsModule('privacyPolicySections.ts', 'PRIVACY_SECTIONS', 'docs/LetsSplyt-Privacy-Policy.md');
writeLegalHtmlPage('terms.html', 'Terms of Service', 'docs/LetsSplyt-Terms-of-Service.md', {
  href: '/privacy.html',
  label: 'Privacy Policy',
});
writeLegalHtmlPage('privacy.html', 'Privacy Policy', 'docs/LetsSplyt-Privacy-Policy.md', {
  href: '/terms.html',
  label: 'Terms of Service',
});
fs.writeFileSync(
  path.join(outDir, 'index.ts'),
  "export type { LegalSection } from './legal.types';\nexport { TERMS_SECTIONS } from './termsOfServiceSections';\nexport { PRIVACY_SECTIONS } from './privacyPolicySections';\n",
);

for (const legacy of [
  'termsOfService.ts',
  'privacyPolicy.ts',
  'termsOfServiceHtml.ts',
  'privacyPolicyHtml.ts',
]) {
  const legacyPath = path.join(outDir, legacy);
  if (fs.existsSync(legacyPath)) {
    fs.unlinkSync(legacyPath);
  }
}

console.log(`Synced mobile legal sections + web HTML (${LEGAL_DATE})`);
