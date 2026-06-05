'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  slug: string;
  name: string;
}

export default function DeleteEventButton({ slug, name }: Props) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${name}" verwijderen? Dit verwijdert het event voor iedereen.`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Verwijderen mislukt');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Verwijderen mislukt');
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-xs text-fog backdrop-blur transition-colors hover:bg-ember hover:text-white disabled:opacity-50"
      aria-label={`${name} verwijderen`}
      title="Event verwijderen"
    >
      {isDeleting ? '…' : '✕'}
    </button>
  );
}
