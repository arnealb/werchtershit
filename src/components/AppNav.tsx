'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/',
    label: 'Events',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/playlists',
    label: 'Playlists',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8}>
        <path d="M9 18V6l11-2v12" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
      </svg>
    ),
  },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 border-t border-line bg-soot/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((tab) => {
          const active =
            tab.href === '/'
              ? pathname === '/' ||
                (pathname?.startsWith('/e/') ?? false) ||
                (pathname?.startsWith('/events') ?? false) ||
                (pathname?.startsWith('/planner') ?? false)
              : pathname?.startsWith(tab.href) ?? false;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors',
                active ? 'text-ember' : 'text-fog-dim hover:text-fog',
              ].join(' ')}
            >
              {tab.icon(active)}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
