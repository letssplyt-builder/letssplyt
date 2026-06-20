import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const publicDir = path.resolve(__dirname, '../../../../public');

describe('legal static pages', () => {
  it('privacy.html contains the full policy with cross-links to terms', () => {
    const html = fs.readFileSync(path.join(publicDir, 'privacy.html'), 'utf8');

    expect(html).toContain('Information We Collect');
    expect(html).toContain('Receipt Images and AI Processing');
    expect(html).toContain('href="/terms.html"');
    expect(html).not.toContain('mobile app under Settings');
  });

  it('terms.html contains the full terms with cross-links to privacy', () => {
    const html = fs.readFileSync(path.join(publicDir, 'terms.html'), 'utf8');

    expect(html).toContain('Acceptance of Terms');
    expect(html).toContain('mandatory arbitration');
    expect(html).toContain('href="/privacy.html"');
    expect(html).not.toContain('mobile app under Settings');
  });
});
