import { redirect } from 'next/navigation';
import { BUILTIN_EVENT_SLUG } from '@/lib/events';

export default function PlannerRedirect() {
  redirect(`/e/${BUILTIN_EVENT_SLUG}`);
}
