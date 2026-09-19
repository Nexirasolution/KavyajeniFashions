import { NextResponse } from 'next/server';

// Lightweight check only (no crypto in Edge middleware).
// Full JWT verification happens in app/admin/layout.js (Node runtime).
export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = req.cookies.get('lb_admin_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
