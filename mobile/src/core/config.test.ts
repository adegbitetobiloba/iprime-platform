import { parseConfig } from './config';

const ok = { appEnv: 'staging', apiBaseUrl: 'https://iprime.example.com/' };

describe('parseConfig', () => {
  it('strips the trailing slash and derives the api url', () => {
    expect(parseConfig(ok)).toEqual({
      env: 'staging',
      origin: 'https://iprime.example.com',
      apiUrl: 'https://iprime.example.com/api',
    });
  });
  it('defaults the environment to development and allows http there', () => {
    expect(parseConfig({ apiBaseUrl: 'http://localhost:3000' }).env).toBe('development');
  });
  it('rejects a missing, placeholder or malformed url', () => {
    expect(() => parseConfig({})).toThrow('not set');
    expect(() => parseConfig({ apiBaseUrl: 'https://REPLACE-WITH-STAGING-URL' })).toThrow('placeholder');
    expect(() => parseConfig({ apiBaseUrl: 'example.com' })).toThrow('http');
  });
  it('rejects http outside development and a trailing /api', () => {
    expect(() => parseConfig({ appEnv: 'production', apiBaseUrl: 'http://x.com' })).toThrow('https');
    expect(() => parseConfig({ ...ok, apiBaseUrl: 'https://x.com/api' })).toThrow('without /api');
  });
  it('rejects an unknown environment', () => {
    expect(() => parseConfig({ ...ok, appEnv: 'prod' })).toThrow('ENV must be');
  });
});
