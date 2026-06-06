/* Temp unit test (geen netwerk): npx tsx test-extract.tmp.ts */
import type { ExtractedEvent } from './src/lib/lineup-extract';
import { lacksDayInfo, mergeVisionDays, mergeLineupDays } from './src/lib/lineup-merge';
import type { LineupData } from './src/types/lineup';

const artist = (name: string) => ({ name, startTime: '', endTime: '' });

// Tekst-extractie: exacte namen, alles op 1 dag (zoals WECANDANCE)
const base: ExtractedEvent = {
  name: 'WECANDANCE',
  location: 'Zeebrugge',
  days: [
    {
      date: '2026-08-14',
      label: 'Friday',
      stages: [
        {
          stageName: 'Main',
          artists: ['ALYCIA BEZGO B2B ØTTA', 'AMIYA', 'ANOTR', 'BIIANCO B2B EMILIJA', ...Array.from({ length: 20 }, (_, i) => `FILLER ${i}`)].map(artist),
        },
      ],
    },
    { date: '2026-08-15', label: 'Saturday', stages: [] }, // lege dag van het model
  ],
};

console.log('lacksDayInfo (1 echte dag, 24 acts, geen tijden):', lacksDayInfo(base), '— verwacht true');

// Vision-extractie: OCR-foutjes in namen, maar juiste dagen
const vision: ExtractedEvent = {
  name: 'WECANDANCE',
  location: '',
  days: [
    { date: '2026-08-14', label: 'Friday', stages: [{ stageName: 'Main', artists: [artist('AMIYA'), ...Array.from({ length: 10 }, (_, i) => artist(`FILLER ${i}`))] }] },
    { date: '2026-08-15', label: 'Saturday', stages: [{ stageName: 'Main', artists: [artist('ALYCIA BEZOS B2B OTTA'), artist('BIANCO B2B EMILIJA'), ...Array.from({ length: 10 }, (_, i) => artist(`FILLER ${i + 10}`))] }] },
    { date: '2026-08-16', label: 'Sunday', stages: [{ stageName: 'Main', artists: [artist('ANOTR')] }] },
  ],
};

const merged = mergeVisionDays(base, vision);
for (const day of merged.days) {
  console.log(day.label, '→', day.stages.flatMap((s) => s.artists.map((a) => a.name)).filter((n) => !n.startsWith('FILLER')).join(', '));
}
const allNames = merged.days.flatMap((d) => d.stages.flatMap((s) => s.artists.map((a) => a.name)));
console.log('Exacte naam BEZGO behouden:', allNames.includes('ALYCIA BEZGO B2B ØTTA'), '— verwacht true (op Saturday)');
console.log('Totaal artiesten behouden:', allNames.length, '— verwacht 24');

// mergeLineupDays: dag vervangen + dag toevoegen
const day = (key: string, date: string, n: number): LineupData[number] => ({
  day: key, date, hasTimes: false, dayStartMinutes: 720, dayEndMinutes: 780,
  stages: [{ stageName: 'Main', artists: Array.from({ length: n }, (_, i) => ({
    id: `${key}-${i}`, name: `A${i}`, day: key, stage: 'Main',
    startTime: { display: '12:00', minutesFromMidnight: 720 },
    endTime: { display: '13:00', minutesFromMidnight: 780 },
    durationMinutes: 60, color: 'red' as const,
  })) }],
});
const existing: LineupData = [day('2026-08-14', '2026-08-14', 5)];
const incoming: LineupData = [day('2026-08-14', '2026-08-14', 9), day('2026-08-15', '2026-08-15', 7)];
const mergedLineup = mergeLineupDays(existing, incoming);
console.log('mergeLineupDays:', mergedLineup.map((d) => `${d.day}:${d.stages[0].artists.length}`).join(' + '), '— verwacht 2026-08-14:9 + 2026-08-15:7');
