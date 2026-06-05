import type { Metadata, Viewport } from 'next';
import { Anton, Sora } from 'next/font/google';
import AppNav from '@/components/AppNav';
import './globals.css';

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Werchter Planner 2026',
  description:
    'Plan je Rock Werchter 2026: kies artiesten uit de timetable en maak automatisch je voorbereidings-playlist op Spotify.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Werchter',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0908',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`h-full ${anton.variable} ${sora.variable}`}>
      <body className="h-full overflow-hidden">
        <div className="relative z-10 flex h-full flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          <AppNav />
        </div>
      </body>
    </html>
  );
}
