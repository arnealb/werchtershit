import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rock Werchter 2026 — Lineup Planner',
  description: 'Plan your Rock Werchter 2026 experience and build your Spotify playlist.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
