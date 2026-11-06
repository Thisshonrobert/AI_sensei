import type { NextRequest } from 'next/server';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

export function isTrustedAppHost(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();
  const hostHeader = request.headers.get('host')?.toLowerCase() ?? '';

  if (LOOPBACK_HOSTS.has(hostname)) {
    return /^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(hostHeader);
  }

  // Hosted requests pass through src/proxy.ts, which fails closed without APP_PASSWORD.
  const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME?.toLowerCase();
  return process.env.RENDER === 'true'
    && Boolean(process.env.APP_PASSWORD)
    && Boolean(renderHost)
    && hostname === renderHost
    && hostHeader.split(':')[0] === renderHost;
}

export function sameOriginDiagnostics(request: NextRequest) {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const hosted = process.env.RENDER === 'true';
  if (!host || !origin) return { matches: false, originPresent: Boolean(origin), hostPresent: Boolean(host), canonicalOrigin: false, secureOrigin: false, hostMatches: false, fetchSite: request.headers.get('sec-fetch-site') ?? 'missing' };
  try {
    const parsedOrigin = new URL(origin);
    const expectedProtocol = hosted ? 'https:' : request.nextUrl.protocol;
    const expectedHost = hosted ? process.env.RENDER_EXTERNAL_HOSTNAME?.toLowerCase() : host.toLowerCase();
    const canonicalOrigin = parsedOrigin.origin === origin;
    const secureOrigin = parsedOrigin.protocol === expectedProtocol;
    const hostMatches = Boolean(expectedHost) && parsedOrigin.host.toLowerCase() === expectedHost;
    const matches = canonicalOrigin && secureOrigin && hostMatches && request.headers.get('sec-fetch-site') !== 'cross-site';
    return { matches, originPresent: true, hostPresent: true, canonicalOrigin, secureOrigin, hostMatches, fetchSite: request.headers.get('sec-fetch-site') ?? 'missing' };
  } catch {
    return { matches: false, originPresent: true, hostPresent: Boolean(host), canonicalOrigin: false, secureOrigin: false, hostMatches: false, fetchSite: request.headers.get('sec-fetch-site') ?? 'missing' };
  }
}

export function isSameOriginRequest(request: NextRequest) {
  return sameOriginDiagnostics(request).matches;
}
