import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { signAdminToken, setAdminCookie } from '@/lib/auth';

export async function POST(req) {
  await dbConnect();
  const { email, password } = await req.json();
  const admin = await Admin.findOne({ email: (email || '').toLowerCase().trim() });
  if (!admin) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  const ok = await bcrypt.compare(password || '', admin.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

  const token = signAdminToken({ id: admin._id.toString(), email: admin.email, role: admin.role });
  const res = NextResponse.json({ admin: { name: admin.name, email: admin.email, role: admin.role } });
  setAdminCookie(res, token);
  return res;
}
