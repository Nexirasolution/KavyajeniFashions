import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/auth';

export async function GET(req) {
  const admin = getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  return NextResponse.json({ admin });
}
