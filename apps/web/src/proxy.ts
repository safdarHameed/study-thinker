import { NextResponse, type NextRequest } from 'next/server';

/**
 * Redirect UX only. The API sets a non-sensitive `lw_session=1` cookie next to
 * the httpOnly refresh cookie; we use it to skip a flash of the wrong page.
 * We deliberately never redirect *away* from /login based on this cookie: a
 * stale cookie would otherwise cause a redirect loop with the client guard.
 * Real authentication is always enforced by the API (and by <AuthGuard>).
 *
 * Set `LW_PROXY_AUTH_REDIRECTS=false` if the API runs on a different site, where
 * the `lw_session` cookie can't be seen by this app.
 */
const PROTECTED = ['/learnings', '/assessments', '/settings'];

export function proxy(request: NextRequest) {
  if (process.env.LW_PROXY_AUTH_REDIRECTS === 'false') return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.get('lw_session')?.value === '1';
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/learnings/:path*', '/assessments/:path*', '/settings/:path*'],
};
