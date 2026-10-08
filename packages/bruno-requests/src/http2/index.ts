/**
 * HTTP/2 support for Bruno: ALPN-based version decision, pooled HTTP/2 sessions (TLS and cleartext h2c),
 * HTTP/1.1 -> HTTP/2 header translation, and an axios transport adapter. Consumed by the request
 * interceptor (bruno-electron) and the CLI (bruno-cli) via the request layer.
 */
export {
  resolveHttpVersion,
  invalidateAlpn,
  clearAlpnCache,
  HTTP_VERSION
} from './alpn';
export type { HttpVersionPreference, Resolved, ResolveHttpVersionParams } from './alpn';

export {
  acquireH2Session,
  acquireH2cSession,
  closeAllSessions
} from './session';
export type { AcquireH2SessionParams, AcquireH2cSessionParams } from './session';

export { buildHttp2Headers, CONNECTION_SPECIFIC_HEADERS } from './headers';
export type { BuildH2HeadersParams, HeaderValue } from './headers';

export { createHttp2Transport } from './transport';
export type { Http2Transport, Http2TransportRequestOptions } from './transport';

export { acquireH2SessionViaProxy, closeAllProxyAgents } from './proxy';
export type { ProxyInfo, AcquireH2SessionViaProxyParams } from './proxy';

export { pickTlsFields, TLS_FIELDS } from './tls-options';
export type { TlsOptions } from './tls-options';
