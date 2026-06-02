'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Close from '@/app/ui/primitives/Icons/Close';
import { getSafeIdexxIframeUrl } from '@/app/lib/urls';

type PdfPreviewOverlayProps = {
  open: boolean;
  pdfUrl: string | null;
  title: string;
  closeLabel?: string;
  onClose: () => void;
};

const PdfPreviewOverlay = ({
  open,
  pdfUrl,
  title,
  closeLabel = 'Close PDF preview',
  onClose,
}: PdfPreviewOverlayProps) => {
  const [loaded, setLoaded] = useState(false);
  const safePdfUrl = getSafeIdexxIframeUrl(pdfUrl, { allowBlob: true });
  if (!open || !safePdfUrl || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-signing-overlay="true"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl size-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10">
          <div className="text-body-2 text-text-primary">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label={closeLabel}
            style={{ pointerEvents: 'auto' }}
          >
            <Close iconOnly />
          </button>
        </div>
        <div className="relative flex-1 min-h-0">
          {!loaded && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white"
              aria-label="Loading PDF"
              role="status"
            >
              <div className="size-8 rounded-full border-2 border-card-border border-t-text-brand animate-spin" />
              <span className="text-body-4 text-text-secondary">Loading PDF…</span>
            </div>
          )}
          <iframe
            key={safePdfUrl}
            src={safePdfUrl}
            title={title}
            className="size-full border-0"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ pointerEvents: 'auto' }}
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PdfPreviewOverlay;
