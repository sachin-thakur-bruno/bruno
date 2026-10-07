/**
 * Determines which HTTP version to use for a request.
 *
 * http2-wrapper handles the TLS handshake and ALPN negotiation. This module handles HTTP version modes,
 * cleartext HTTP/2 (h2c) and prior-knowledge rules.
 *
 * In `auto` mode, probe results are cached for a limited time so we don't need to
 * perform an extra handshake for every request to the same origin.
 */

import * as http2wrapper from 'http2-wrapper';
import type { LookupFunction } from 'node:net';
import { pickTlsFields } from './tls-options';

export const HTTP_VERSION = {
  AUTO: 'auto',
  HTTP1: 'http1',
  HTTP2: 'http2',
  HTTP2_PRIOR_KNOWLEDGE: 'http2-prior-knowledge'
} as const;

export type Resolved = {
  protocol: 'http1' | 'http2';
  cleartext: boolean;
  reason: string;
  alpn?: string;
  offered?: string[];
  cached?: boolean;
};

export type HttpVersionPreference = (typeof HTTP_VERSION)[keyof typeof HTTP_VERSION];

export type ResolveHttpVersionParams = {
  url: string;
  httpVersionPreference: HttpVersionPreference;
  tlsOptions?: Record<string, unknown> | null;
  lookup?: LookupFunction;
};

const SUPPORTED_ALPN_PROTOCOLS = ['h2', 'http/1.1'] as const;

const alpnCache = http2wrapper.auto.protocolCache;
const resolveAlpnProtocol = http2wrapper.auto.resolveProtocol;

// Must match http2-wrapper's key: `${host}:${port}:${ALPNProtocols.sort()}` (array -> comma-joined string).
const getAlpnCacheKey = (hostname: string, port: number): string =>
  `${hostname}:${port}:${[...SUPPORTED_ALPN_PROTOCOLS].sort().join(',')}`;

const getPort = (url: URL): number =>
  Number(url.port) || (url.protocol === 'https:' ? 443 : 80);

export async function resolveHttpVersion(params: ResolveHttpVersionParams): Promise<Resolved> {
  const { url, httpVersionPreference, tlsOptions, lookup } = params;

  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;
  const port = getPort(parsedUrl);

  // Cleartext: ALPN does not exist without TLS. Only prior knowledge can select h2 here.
  if (parsedUrl.protocol !== 'https:') {
    if (httpVersionPreference === HTTP_VERSION.HTTP2_PRIOR_KNOWLEDGE) {
      return {
        protocol: HTTP_VERSION.HTTP2,
        cleartext: true,
        reason: 'HTTP/2 prior knowledge (h2c, no ALPN)'
      };
    }

    return {
      protocol: HTTP_VERSION.HTTP1,
      cleartext: true,
      reason: 'cleartext URL; h2c requires HTTP/2 (prior knowledge)'
    };
  }

  if (httpVersionPreference === HTTP_VERSION.HTTP1) {
    return {
      protocol: HTTP_VERSION.HTTP1,
      cleartext: false,
      reason: 'HTTP/1.1 selected by preference'
    };
  }

  // Over TLS, "prior knowledge" has no separate meaning: both modes require h2 via ALPN offering only h2.
  if (
    httpVersionPreference === HTTP_VERSION.HTTP2
    || httpVersionPreference === HTTP_VERSION.HTTP2_PRIOR_KNOWLEDGE
  ) {
    return {
      protocol: HTTP_VERSION.HTTP2,
      cleartext: false,
      reason: 'HTTP/2 selected by preference (TLS, h2 required)'
    };
  }

  // Auto mode: probe the server for ALPN support and cache the result.
  const isCached = alpnCache.has(getAlpnCacheKey(hostname, port));

  try {
    const { alpnProtocol: negotiatedProtocol } = await resolveAlpnProtocol({
      host: hostname,
      port,
      servername: hostname,
      ALPNProtocols: [...SUPPORTED_ALPN_PROTOCOLS],
      ...pickTlsFields(tlsOptions),
      ...(lookup ? { lookup } : {}) });

    const protocol = negotiatedProtocol === 'h2' ? HTTP_VERSION.HTTP2 : HTTP_VERSION.HTTP1;

    return {
      protocol,
      cleartext: false,
      alpn: negotiatedProtocol,
      offered: [...SUPPORTED_ALPN_PROTOCOLS],
      cached: isCached,
      reason: `ALPN negotiated ${negotiatedProtocol || 'nothing'}${isCached ? ' (cached)' : ''}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      protocol: HTTP_VERSION.HTTP1,
      cleartext: false,
      reason: `ALPN probe failed (${errorMessage}); using HTTP/1.1`
    };
  }
}

export const invalidateAlpn = (hostname: string, port: number): boolean =>
  alpnCache.delete(getAlpnCacheKey(hostname, port));

export const clearAlpnCache = (): void => alpnCache.clear();
