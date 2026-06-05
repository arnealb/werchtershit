import { getValidTokens } from '@/lib/spotify';
import EventImportWizard from '@/components/EventImportWizard';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const tokens = await getValidTokens();

  return (
    <div className="h-full overflow-y-auto bg-coal">
      <header className="sticky top-0 z-10 border-b border-line bg-soot/90 backdrop-blur px-4 pt-3 pb-3 pt-safe">
        <h1 className="font-display text-xl text-cream uppercase">
          Event <span className="text-ember">toevoegen</span>
        </h1>
        <p className="text-xs text-fog mt-0.5">Festival of concert — AI doet het zware werk</p>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        <EventImportWizard isAuthenticated={!!tokens} />
      </div>
    </div>
  );
}
