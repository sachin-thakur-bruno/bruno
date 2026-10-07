/**
 * HTTP/2 session pools.
 *
 * A session is one TCP(+TLS) connection that multiplexes many request streams. Reusing it across
 * requests to the same origin is where HTTP/2's latency win comes from, so sessions are pooled here and
 * handed to the transport per request.
 */
import http2, { type ClientHttp2Session, type SecureClientSessionOptions } from 'node:http2';
import * as http2wrapper from 'http2-wrapper';
import type { LookupFunction } from 'node:net';
import type { TLSSocket } from 'node:tls';
import { pickTlsFields } from './tls-options';

export type AcquireH2SessionParams = {
  origin: string;
  tlsOptions?: Record<string, unknown> | null;
  lookup?: LookupFunction;
};

/**
 * http2-wrapper Agent with a workaround for TLS socket errors.
 *
 * On Node 22, some TLS errors can destroy the HTTP/2 session without emitting
 * a session `error` or `close` event. This leaves the Agent waiting forever
 * and blocks later requests to the same origin.
 *
 * Destroying the socket ensures the session closes and the Agent can reject
 * the request with the original TLS error.
 */
class SessionAgent extends http2wrapper.Agent {
  async createConnection(origin: URL, options: SecureClientSessionOptions): Promise<TLSSocket> {
    const socket = await super.createConnection(origin, options);
    socket.once('error', () => {
      if (!socket.destroyed) socket.destroy();
    });
    return socket;
  }
}

const agent = new SessionAgent();

/**
 * Acquire (or reuse) a pooled HTTP/2 session to a TLS origin.
 */
export function acquireH2Session({ origin, tlsOptions, lookup }: AcquireH2SessionParams): Promise<ClientHttp2Session> {
  return agent.getSession(origin, {
    ...pickTlsFields(tlsOptions),
    ...(lookup ? { lookup } : {})
  });
}

/** Destroy every pooled session (app quit, CLI run end, HTTP version preference change). */
export type AcquireH2cSessionParams = {
  /** `http://hostname:port` of the target, port explicit. */
  origin: string;
  lookup?: LookupFunction;
};

/**
 * Reuses cleartext HTTP/2 (h2c) sessions by origin.
 *
 * This is used only for `http://` requests with HTTP/2 prior knowledge.
 * http2-wrapper can't pool cleartext sessions, so we manage them here.
 *
 * cache the connection promise so concurrent requests to the same origin
 * share a single connection attempt.
 */
const h2cSessions = new Map<string, Promise<ClientHttp2Session>>();

export function acquireH2cSession({ origin, lookup }: AcquireH2cSessionParams): Promise<ClientHttp2Session> {
  const existing = h2cSessions.get(origin);
  if (existing) return existing;

  const pending = new Promise<ClientHttp2Session>((resolve, reject) => {
    const session = http2.connect(origin, lookup ? { lookup } : {});

    const forget = () => {
      if (h2cSessions.get(origin) === pending) h2cSessions.delete(origin);
    };

    // With prior knowledge, we don't know whether the server supports HTTP/2
    // until it responds with its SETTINGS frame.
    session.once('remoteSettings', () => resolve(session));

    session.once('error', (error) => {
      forget();
      reject(error);
    });

    // A session that received GOAWAY can't accept new streams, so remove it
    // from the pool and let the next request create a new one.
    session.once('goaway', forget);
    session.once('close', forget);
  });

  h2cSessions.set(origin, pending);
  return pending;
}

/** Destroy every pooled session, TLS and h2c (app quit, CLI run end, HTTP version preference change). */
export function closeAllSessions(): void {
  agent.destroy();
  for (const pending of h2cSessions.values()) {
    pending.then((session) => session.destroy()).catch(() => undefined);
  }
  h2cSessions.clear();
}
