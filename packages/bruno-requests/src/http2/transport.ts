/**
 * Axios transport adapter for HTTP/2.
 *
 * Axios expects `transport.request()` to return a writable request and pass a
 * readable response to the callback. With HTTP/2, a `ClientHttp2Stream` handles
 * both sides, so we use the stream directly.
 *
 * avoid http2-wrapper's `ClientRequest` because it emits a `socket` event.
 * Axios then tries to configure that socket with `setKeepAlive()`, which HTTP/2
 * does not allow and throws `ERR_HTTP2_NO_SOCKET_MANIPULATION`.
 */
import { constants, type ClientHttp2Session, type ClientHttp2Stream, type IncomingHttpHeaders } from 'node:http2';
import { buildHttp2Headers, type HeaderValue } from './headers';

const { HTTP2_HEADER_STATUS } = constants;

/** Request options used by this transport. */
export type Http2TransportRequestOptions = {
  method?: string;
  protocol?: string;
  hostname?: string;
  port?: number | string;
  path?: string;
  headers?: Record<string, HeaderValue>;
};

export type Http2Transport = {
  request: (options: Http2TransportRequestOptions, callback: (response: ClientHttp2Stream) => void) => ClientHttp2Stream;
};

/** Build a URL from axios request options, adding brackets around IPv6 hosts when needed. */
const toUrl = (options: Http2TransportRequestOptions): string => {
  const protocol = options.protocol || 'https:';
  const rawHost = options.hostname || 'localhost';
  const host = rawHost.includes(':') && !rawHost.startsWith('[') ? `[${rawHost}]` : rawHost;
  const authority = options.port ? `${host}:${options.port}` : host;
  return `${protocol}//${authority}${options.path || '/'}`;
};

/**
 * Create an axios transport for an existing HTTP/2 session.
 *
 * Session creation and pooling are handled by the caller. This transport only
 * creates a new HTTP/2 stream for each request.
 */
export function createHttp2Transport({ session }: { session: ClientHttp2Session }): Http2Transport {
  return {
    request(options, callback) {
      const headers = buildHttp2Headers({
        method: options.method || 'GET',
        url: toUrl(options),
        headers: options.headers
      });

      const stream = session.request(headers);

      stream.once('response', (responseHeaders: IncomingHttpHeaders) => {
        const { [HTTP2_HEADER_STATUS]: status, ...rest } = responseHeaders;

        // Axios expects the response to have `statusCode` and `headers`.
        const response = stream as ClientHttp2Stream & { statusCode?: number; headers?: IncomingHttpHeaders };
        response.statusCode = Number(status);
        response.headers = rest;

        callback(stream);
      });

      return stream;
    }
  };
}
