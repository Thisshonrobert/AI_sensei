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
  if (!host || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  return request.headers.get('origin') === `${request.nextUrl.protocol}//${host}`;
}
