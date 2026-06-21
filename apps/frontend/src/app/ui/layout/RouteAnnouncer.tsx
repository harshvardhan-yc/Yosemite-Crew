'use client';

import { usePathname, useSearchParams } from 'next/navigation';

const getAnnouncementText = () => {
  if (typeof document === 'undefined') return 'Page updated';
  const title = document.title.trim();
  return title ? `${title} loaded` : 'Page updated';
};

const RouteAnnouncer = () => {
  usePathname();
  useSearchParams();
  const announcement = getAnnouncementText();

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
};

export default RouteAnnouncer;
