import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders iframe for blob URL (CSP object-src none blocks <object>; frame-src blob: is allowed)', () => {
    render(
      <PdfPreviewOverlay
        open
        pdfUrl="blob:https://app.yosemitecrew.com/abc"
        title="Blob Preview"
        onClose={jest.fn()}
      />
    );

    const iframe = screen.getByTitle('Blob Preview');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe).toHaveAttribute('src', 'blob:https://app.yosemitecrew.com/abc');
    expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  });

  it('shows loader before iframe loads and hides it after', () => {
    render(
      <PdfPreviewOverlay
        open
        pdfUrl="https://integration.vetconnectplus.com/acknowledgment/1"
        title="Preview"
        onClose={jest.fn()}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading PDF' })).toBeInTheDocument();

    fireEvent.load(screen.getByTitle('Preview'));

    expect(screen.queryByRole('status', { name: 'Loading PDF' })).not.toBeInTheDocument();
  });

  it('renders optional download action without making it required for existing viewers', () => {
    const onDownload = jest.fn();
    const onClose = jest.fn();
    render(
      <PdfPreviewOverlay
        open
        pdfUrl="https://integration.vetconnectplus.com/acknowledgment/1"
        title="Preview"
        downloadLabel="Download preview"
        onDownload={onDownload}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download preview' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not render iframe for unsafe URL schemes', () => {
    render(
      <PdfPreviewOverlay open pdfUrl="javascript:alert(1)" title="Blocked" onClose={jest.fn()} />
    );

    expect(screen.queryByTitle('Blocked')).not.toBeInTheDocument();
  });
});
