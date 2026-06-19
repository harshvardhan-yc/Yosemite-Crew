import fs from 'node:fs';
import type { PdfContext } from '../PdfContext.js';
import { ensureSpace } from '../Pagination.js';
import type { DocumentEndBlockInput } from '../types.js';
import { renderParagraph } from './Text.js';

const estimateSignatureHeight = (signature?: DocumentEndBlockInput['signature']): number => {
  if (!signature) {
    return 96;
  }

  const hasImage = Boolean(signature.signatureImagePath);
  const detailsLines = [
    signature.signerName,
    [signature.signerRole, signature.signerDegree].filter(Boolean).join(' '),
    signature.signedAt ? String(signature.signedAt) : undefined,
  ].filter(Boolean).length;

  return hasImage ? 132 + detailsLines * 10 : 104 + detailsLines * 10;
};

const formatSignedAt = (value?: Date | string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

export const renderDocumentEndBlock = (ctx: PdfContext, input: DocumentEndBlockInput): void => {
  const signature = input.signature ?? { status: 'PENDING' };
  const signatureWidth = Math.min(220, ctx.contentWidth * 0.42);
  const leftWidth = ctx.contentWidth - signatureWidth - 28;
  const estimatedHeight = Math.max(estimateSignatureHeight(signature), 84);

  ensureSpace(ctx, estimatedHeight);

  const startY = ctx.cursorY;
  const signatureX = ctx.contentRight - signatureWidth;
  const leftX = ctx.contentLeft;

  ctx.document.save();

  ctx.document
    .font(ctx.theme.fonts.bold)
    .fontSize(ctx.theme.fontSizes.small)
    .fillColor(ctx.theme.colors.muted)
    .text('Printed By', leftX, startY, {
      width: leftWidth,
    });

  ctx.document
    .font(ctx.theme.fonts.regular)
    .fontSize(ctx.theme.fontSizes.body)
    .fillColor(ctx.theme.colors.text)
    .text(input.printedBy ?? '—', leftX, startY + 14, {
      width: leftWidth,
    });

  const signatureLabel = signature.label ?? 'Signature';
  ctx.document
    .font(ctx.theme.fonts.bold)
    .fontSize(ctx.theme.fontSizes.small)
    .fillColor(ctx.theme.colors.muted)
    .text(signatureLabel, signatureX, startY, {
      width: signatureWidth,
      align: 'right',
    });

  const lineY = startY + 22;
  const lineWidth = signatureWidth;
  let drewFallbackLine = false;

  if (signature.status === 'SIGNED' && signature.signatureImagePath) {
    try {
      if (fs.existsSync(signature.signatureImagePath)) {
        ctx.document.image(signature.signatureImagePath, signatureX, lineY, {
          fit: [lineWidth, 42],
        });
      } else {
        drewFallbackLine = true;
      }
    } catch {
      drewFallbackLine = true;
    }
  } else {
    drewFallbackLine = true;
  }

  if (drewFallbackLine) {
    ctx.document
      .moveTo(signatureX, lineY + 24)
      .lineTo(signatureX + lineWidth, lineY + 24)
      .lineWidth(0.8)
      .strokeColor(ctx.theme.colors.border)
      .stroke();
  }

  const details: string[] = [];
  if (signature.status === 'SIGNED') {
    if (signature.signerName) {
      details.push(signature.signerName);
    }
    const role = [signature.signerRole, signature.signerDegree].filter(Boolean).join(' ');
    if (role) {
      details.push(role);
    }
    const signedAt = formatSignedAt(signature.signedAt);
    if (signedAt) {
      details.push(`Signed ${signedAt}`);
    }
  } else {
    details.push('Pending signature');
  }

  ctx.document
    .font(ctx.theme.fonts.regular)
    .fontSize(ctx.theme.fontSizes.small)
    .fillColor(ctx.theme.colors.muted)
    .text(details.join('\n'), signatureX, lineY + 34, {
      width: signatureWidth,
      align: 'right',
      lineGap: 2,
    });

  ctx.document.restore();
  ctx.moveDown(estimatedHeight);
};

export const renderPrintedBy = (ctx: PdfContext, printedBy?: string): void => {
  renderParagraph(ctx, printedBy ?? '—', {
    fontSize: ctx.theme.fontSizes.body,
  });
};
