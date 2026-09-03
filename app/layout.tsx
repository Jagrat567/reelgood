import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reelgood — Find your next movie',
  description: 'Personal movie picks for your mood, without the endless scrolling.',
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
