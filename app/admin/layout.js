import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';
import NewOrderListener from '@/components/admin/NewOrderListener'; // 👈 add this

export default function AdminLayout({ children }) {
  const token = cookies().get('lb_admin_token')?.value;
  const admin = token ? verifyAdminToken(token) : null;

  if (!admin) return <>{children}</>;

  return (
    <AdminShell admin={admin}>
      <NewOrderListener /> {/* 👈 add this */}
      {children}
    </AdminShell>
  );
}