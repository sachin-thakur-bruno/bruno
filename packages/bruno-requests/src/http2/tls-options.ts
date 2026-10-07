/**
 * TLS options shared by the ALPN probe and HTTP/2 session pools.
 *
 * https.Agent options also include settings like `keepAlive` and `maxSockets`
 * that aren't relevant to TLS or HTTP/2 connections. We only pick the TLS options
 * needed by `tls.connect` and `http2.connect` instead of passing the entire object.
 */

import type { ConnectionOptions } from 'node:tls';

export type TlsOptions = Pick<
  ConnectionOptions,
  | 'ca'
  | 'cert'
  | 'key'
  | 'pfx'
  | 'passphrase'
  | 'rejectUnauthorized'
  | 'servername'
  | 'minVersion'
  | 'maxVersion'
  | 'ciphers'
  | 'secureProtocol'
>;

export const TLS_FIELDS = [
  'ca',
  'cert',
  'key',
  'pfx',
  'passphrase',
  'rejectUnauthorized',
  'servername',
  'minVersion',
  'maxVersion',
  'ciphers',
  'secureProtocol'
] as const satisfies readonly (keyof TlsOptions)[];

export function pickTlsFields(options?: Record<string, unknown> | null): TlsOptions {
  const out: Record<string, unknown> = {};
  if (!options) return out;
  for (const field of TLS_FIELDS) {
    if (options[field] !== undefined) out[field] = options[field];
  }
  return out as TlsOptions;
}
