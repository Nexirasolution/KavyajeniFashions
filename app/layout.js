import './globals.css';
import { Playfair_Display, Poppins } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from '@/components/CartContext';
import { WishlistProvider } from '@/components/WhishlistContext';
import BottomNav from '@/components/BottomNav';
import { dbConnect } from '@/lib/mongodb';
import Settings from '@/models/Settings';

const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'] });
const body = Poppins({ subsets: ['latin'], variable: '--font-body', weight: ['300', '400', '500', '600', '700'] });

export async function generateMetadata() {
  let settings = null;
  try {
    await dbConnect();
    settings = await Settings.findOne({ key: 'global' });
  } catch {
    settings = null;
  }
  const title = settings?.seoTitle || 'Lakshmibala Clothing Store - Women Kurtis, Innerwear & More';
  const description =
    settings?.seoDescription ||
    'Shop trendy women kurtis, rayon umbrella kurtis, side open kurtis, nighties, 2 piece sets and innerwear online from Lakshmibala Clothing Store, Sivakasi, Tamil Nadu.';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lakshmibala.in';
  return {
    title: { default: title, template: '%s | Lakshmibala Clothing Store' },
    description,
    metadataBase: new URL(siteUrl),
    keywords: ['women kurtis online', 'umbrella kurti', 'side open kurti', 'nighties online', 'innerwear online', 'Sivakasi clothing store'],
    openGraph: { title, description, siteName: 'Lakshmibala Clothing Store', type: 'website' },
    icons: { icon: '/favicon.ico' }
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-body antialiased bg-brand-cream`}>
        <CartProvider>
          <WishlistProvider>
            {children}

            {/* spacer so page content isn't hidden behind the fixed mobile nav */}
            <div className="md:hidden h-16" />

            <BottomNav />
          </WishlistProvider>
        </CartProvider>

        <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'var(--font-body)' } }} />
      </body>
    </html>
  );
}