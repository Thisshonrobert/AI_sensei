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

export function isSameOriginRequest(request: NextRequest) {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  if (!host || !origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try {
    const parsedOrigin = new URL(origin);
    const hosted = process.env.RENDER === 'true';
    const expectedProtocol = hosted ? 'https:' : request.nextUrl.protocol;
    const expectedHost = hosted ? process.env.RENDER_EXTERNAL_HOSTNAME?.toLowerCase() : host.toLowerCase();
    const matches = Boolean(expectedHost)
      && parsedOrigin.origin === origin
      && parsedOrigin.protocol === expectedProtocol
      && parsedOrigin.host.toLowerCase() === expectedHost;
    if (!matches && hosted) {
      console.warn('same-origin-guard', JSON.stringify({
        originPresent: Boolean(origin),
        canonicalOrigin: parsedOrigin.origin === origin,
        secureOrigin: parsedOrigin.protocol === 'https:',
        hostMatches: Boolean(expectedHost) && parsedOrigin.host.toLowerCase() === expectedHost,
        expectedHostConfigured: Boolean(expectedHost),
        hostHeaderPresent: Boolean(host),
        fetchSite: request.headers.get('sec-fetch-site') ?? 'missing',
      }));
    }
    return matches;
  } catch {
    return false;
  }
}
