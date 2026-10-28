import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Single-user password gate for hosted deployments (HTTP basic auth; any username).
// Local runs have no APP_PASSWORD and stay open; a Vercel or Render deployment without one is refused.
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return (process.env.VERCEL || process.env.RENDER) ? new NextResponse('Not configured', { status: 503 }) : NextResponse.next();
  }
  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const given = atob(header.slice(6)).split(':').slice(1).join(':');
      if (given === password) return NextResponse.next();
    } catch {}
  }
  return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="AI Sensei", charset="UTF-8"' } });
}
