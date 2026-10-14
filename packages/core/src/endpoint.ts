import { ClientError } from './errors';
import { hasControlOrSpace } from './input';

export interface Endpoint {
  readonly baseUrl: string;
  readonly origin: string;
}

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function normalizeEndpoint(input: string, allowLoopbackHttp = false): Endpoint {
  const raw = input.trim();
  if (raw.length > 4096 || raw.includes('\\') || hasControlOrSpace(raw)) {
    throw new ClientError('INVALID_ENDPOINT');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ClientError('INVALID_ENDPOINT');
  }
  const safeProtocol =
    url.protocol === 'https:' ||
    (allowLoopbackHttp && url.protocol === 'http:' && loopbackHosts.has(url.hostname));
  if (!safeProtocol || url.username || url.password || url.search || url.hash) {
    throw new ClientError('INVALID_ENDPOINT');
  }
  // Inspect the original path: URL() would silently normalize dot traversal.
  const path = raw.match(/^[a-z]+:\/\/[^/?#]+([^?#]*)/iu)?.[1] ?? '';
  try {
    for (const part of path.split('/').filter(Boolean)) {
      const decoded = decodeURIComponent(part);
      if (!/^[a-z0-9._~-]+$/iu.test(decoded) || decoded === '.' || decoded === '..') {
        throw new ClientError('INVALID_ENDPOINT');
      }
    }
  } catch {
    throw new ClientError('INVALID_ENDPOINT');
  }
  const baseUrl = `${url.origin}${url.pathname.replace(/\/+$/u, '')}/`;
  return Object.freeze({ baseUrl, origin: url.origin });
}

/** Routes are application-owned, never supplied by a server capability response. */
export function endpointUrl(endpoint: Endpoint, route: string): URL {
  if (!/^[a-z0-9/_-]+$/iu.test(route) || route.startsWith('/') || route.includes('//')) {
    throw new ClientError('INVALID_ENDPOINT');
  }
  const url = new URL(route, endpoint.baseUrl);
  if (url.origin !== endpoint.origin || !url.href.startsWith(endpoint.baseUrl)) {
    throw new ClientError('INVALID_ENDPOINT');
  }
  return url;
}
