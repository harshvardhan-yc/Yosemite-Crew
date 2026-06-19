import type { PdfContext } from '../PdfContext.js';

const formatTimestamp = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

export const renderFooter = (
  ctx: PdfContext,
  pageNumber: number,
  totalPages: number,
  generatedAt: Date = ctx.generatedAt
): void => {
  const { document } = ctx;
  const footerTop = ctx.pageHeight - ctx.footerHeight + 12;
  const footerBottom = ctx.pageHeight - 16;
  const leftX = ctx.contentLeft;
  const rightX = ctx.contentRight;

  document.save();

  document
    .moveTo(ctx.contentLeft, footerTop - 8)
    .lineTo(ctx.contentRight, footerTop - 8)
    .lineWidth(1)
    .strokeColor(ctx.theme.colors.border)
    .stroke();

  const footerLeftLines = [
    ctx.organization.name,
    ctx.organization.legalName,
    ctx.organization.footerText,
    ctx.organization.addressLine1,
    ctx.organization.addressLine2,
  ].filter(Boolean);

  document
    .font(ctx.theme.fonts.regular)
    .fontSize(8)
    .fillColor(ctx.theme.colors.muted)
    .text(footerLeftLines.join(' | '), leftX, footerTop, {
      width: ctx.contentWidth - 180,
      lineGap: 2,
    });

  document
    .font(ctx.theme.fonts.bold)
    .fontSize(8.5)
    .fillColor(ctx.theme.colors.text)
    .text(`Page ${pageNumber} of ${totalPages}`, rightX - 140, footerTop, {
      width: 140,
      align: 'right',
    });

  document
    .font(ctx.theme.fonts.regular)
    .fontSize(7.5)
    .fillColor(ctx.theme.colors.muted)
    .text(`Generated ${formatTimestamp(generatedAt)}`, rightX - 170, footerBottom, {
      width: 170,
      align: 'right',
    });

  document.restore();
};
