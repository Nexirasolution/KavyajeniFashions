export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lakshmibala.in';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
