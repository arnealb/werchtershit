import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Werchter Planner 2026',
    short_name: 'Werchter',
    description:
      'Plan je Rock Werchter 2026: kies artiesten uit de timetable en maak automatisch je voorbereidings-playlist op Spotify.',
    start_url: '/planner',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0908',
    theme_color: '#0a0908',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
