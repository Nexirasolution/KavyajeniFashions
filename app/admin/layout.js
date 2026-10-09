import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';
import NewOrderListener from '@/components/admin/NewOrderListener'; // 👈 add this

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export default async function AdminLayout({ children }) {
  const token = (await cookies()).get('lb_admin_token')?.value;
  const admin = token ? verifyAdminToken(token) : null;

  if (!admin) return <>{children}</>;

  return (
    <AdminShell admin={admin}>
      <NewOrderListener /> {/* 👈 add this */}
      {children}
    </AdminShell>
  );
}