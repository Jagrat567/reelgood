import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reelgood — Find your next movie',
  applicationName: 'Reelgood',
  description: 'Personal movie picks for your mood, without the endless scrolling.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Reelgood',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Reelgood — Less scrolling. More watching.',
    description: 'Personal movie picks for your mood, without the endless scrolling.',
    type: 'website',
    images: [{ url: '/og.png', width: 1536, height: 864, alt: 'Reelgood movie recommendations' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reelgood — Less scrolling. More watching.',
    description: 'Personal movie picks for your mood, without the endless scrolling.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#e50914',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
        <PwaRegister />
        {process.env.VERCEL === '1' && <Analytics />}
        {process.env.VERCEL === '1' && <SpeedInsights />}
      </body>
    </html>
  );
}
