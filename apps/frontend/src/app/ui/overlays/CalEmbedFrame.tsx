'use client';

import React, { useEffect, useRef } from 'react';
import { getCalApi } from '@calcom/embed-react';

type CalEmbedFrameProps = {
  calLink: 'yosemitecrew/demo' | 'yosemitecrew/onboarding';
  title: string;
  className?: string;
};

const CAL_EMBED_NAMESPACE = '30min';
const CAL_EMBED_CONFIG = {
  theme: 'light' as const,
  layout: 'month_view' as const,
};

export const getCalEmbedUrl = (calLink: CalEmbedFrameProps['calLink']): string => {
  const params = new URLSearchParams({
    theme: 'light',
    layout: 'month_view',
    embedType: 'inline',
    embed: CAL_EMBED_NAMESPACE,
  });

  return `https://app.cal.com/${calLink}/embed?${params.toString()}`;
};

const CalEmbedFrame = ({
  calLink,
  title,
  className = 'flex-1 w-full border-0',
}: CalEmbedFrameProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current as HTMLDivElement;

    let cancelled = false;
    container.replaceChildren();

    const mountCalendar = async () => {
      const cal = await getCalApi({ namespace: CAL_EMBED_NAMESPACE });
      if (cancelled || !container.isConnected) return;

      cal('ui', {
        hideEventTypeDetails: false,
        layout: CAL_EMBED_CONFIG.layout,
      });
      cal('inline', {
        elementOrSelector: container,
        calLink,
        config: CAL_EMBED_CONFIG,
      });
    };

    mountCalendar();

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [calLink]);

  return (
    <div
      ref={containerRef}
      aria-label={title}
      data-cal-embed-frame="true"
      data-cal-embed-src={getCalEmbedUrl(calLink)}
      className={className}
      style={{ pointerEvents: 'auto' }}
    />
  );
};

export default CalEmbedFrame;
