/**
 * Guards TLS sockets created by HTTP/2 agents against a Node 22 failure mode.
 *
 * After a successful TLS handshake, the server may send an alert (for example,
 * when an mTLS request is missing a client certificate). Node emits `error` on
 * the TLS socket and destroys the HTTP/2 session, but the session may emit
 * neither `error` nor `close`. This leaves http2-wrapper's Agent waiting
 * indefinitely and blocks later requests to the same origin.
 *
 * Destroying the socket on `error` forces the session to close, allowing the
 * Agent to reject the pending request with the original error and clear its queue.
 */
import type { Agent } from 'http2-wrapper';
import type { SecureClientSessionOptions } from 'node:http2';
import type { TLSSocket } from 'node:tls';

type AgentConstructor = new (...args: any[]) => Agent;

/** Adds the socket error guard to an Agent or Agent subclass. */
export function withSocketGuard<TBase extends AgentConstructor>(Base: TBase): TBase {
  class Guarded extends Base {
    async createConnection(origin: URL, options: SecureClientSessionOptions): Promise<TLSSocket> {
      const socket = (await super.createConnection(origin, options)) as TLSSocket;
      socket.once('error', () => {
        if (!socket.destroyed) socket.destroy();
      });
      return socket;
    }
  }

  return Guarded;
}
