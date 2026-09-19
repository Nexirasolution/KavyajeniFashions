import { NextResponse } from 'next/server';
import { getAdminFromRequest } from './auth';

// Wrap a route handler to require a valid admin cookie.
export function requireAdmin(handler) {
  return async (req, ctx) => {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized. Please login to admin.' }, { status: 401 });
    }
    return handler(req, ctx, admin);
  };
}
