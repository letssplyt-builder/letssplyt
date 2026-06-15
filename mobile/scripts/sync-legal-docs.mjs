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

console.log(`Synced mobile legal sections (${LEGAL_DATE})`);
