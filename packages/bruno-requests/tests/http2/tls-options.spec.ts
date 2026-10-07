import { pickTlsFields, TLS_FIELDS } from '../../src/http2/tls-options';

describe('pickTlsFields', () => {
  test('returns an empty object for null/undefined input', () => {
    expect(pickTlsFields(undefined)).toEqual({});
    expect(pickTlsFields(null)).toEqual({});
  });

  test('copies only TLS fields and drops https.Agent-only options', () => {
    const picked = pickTlsFields({
      ca: 'CA',
      cert: 'CERT',
      key: 'KEY',
      rejectUnauthorized: false,
      keepAlive: true,
      maxSockets: 5,
      timeout: 1000
    });
    expect(picked).toEqual({ ca: 'CA', cert: 'CERT', key: 'KEY', rejectUnauthorized: false });
  });

  test('drops fields that are explicitly undefined', () => {
    expect(pickTlsFields({ ca: undefined, passphrase: 'pw' })).toEqual({ passphrase: 'pw' });
  });

  test('every listed field is forwarded', () => {
    const input = Object.fromEntries(TLS_FIELDS.map((f) => [f, `v-${f}`]));
    expect(pickTlsFields(input)).toEqual(input);
  });
});
