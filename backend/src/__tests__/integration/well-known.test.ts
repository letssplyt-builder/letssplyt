import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import app from '../../app';

describe('Deep link well-known files', () => {
  it('GET /.well-known/apple-app-site-association → 200 application/json', async () => {
    const response = await request(app).get('/.well-known/apple-app-site-association');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.applinks?.details?.[0]?.appID).toContain('com.letssplyt.app');
    expect(response.body.applinks?.details?.[0]?.paths).toContain('/join/*');
  });

  it('GET /.well-known/assetlinks.json → 200 application/json', async () => {
    const response = await request(app).get('/.well-known/assetlinks.json');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body[0]?.target?.package_name).toBe('com.letssplyt.staging');
    expect(response.body[0]?.target?.sha256_cert_fingerprints?.[0]).toContain('37:D6:B3');
  });
});
