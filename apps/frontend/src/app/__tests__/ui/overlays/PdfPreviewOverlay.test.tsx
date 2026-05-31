import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PdfPreviewOverlay from '@/app/ui/overlays/PdfPreviewOverlay';

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: () => <span>close</span>,
}));

describe('PdfPreviewOverlay', () => {
  it('renders iframe for allowed HTTPS IDEXX URL', () => {
    render(
      <PdfPreviewOverlay
        open
        pdfUrl="https://integration.vetconnectplus.com/acknowledgment/1"
        title="Preview"
        onClose={jest.fn()}
      />
    );

    const iframe = screen.getByTitle('Preview');
    expect(iframe).toHaveAttribute(
      'src',
      'https://integration.vetconnectplus.com/acknowledgment/1'
    );
    expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect(iframe).not.toHaveAttribute('sandbox');
  });

  it('renders object element for blob URL (Safari frame-ancestors workaround)', () => {
    render(
      <PdfPreviewOverlay
        open
        pdfUrl="blob:https://app.yosemitecrew.com/abc"
        title="Blob Preview"
        onClose={jest.fn()}
      />
    );

    // blob: URLs use <object> not <iframe> — Safari enforces frame-ancestors 'none'
    // on blob frames and blocks them; <object> is not subject to frame-ancestors.
    const obj = screen.getByLabelText('Blob Preview');
    expect(obj.tagName).toBe('OBJECT');
    expect(obj).toHaveAttribute('data', 'blob:https://app.yosemitecrew.com/abc');
    expect(obj).toHaveAttribute('type', 'application/pdf');
    expect(screen.queryByTitle('Blob Preview')).not.toBeInTheDocument();
  });

  it('does not render iframe for unsafe URL schemes', () => {
    render(
      <PdfPreviewOverlay open pdfUrl="javascript:alert(1)" title="Blocked" onClose={jest.fn()} />
    );

    expect(screen.queryByTitle('Blocked')).not.toBeInTheDocument();
  });
});
