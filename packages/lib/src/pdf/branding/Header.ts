import fs from 'node:fs';
import axios from 'axios';
import type { PdfContext } from '../PdfContext.js';

const HEADER_LOGO_SIZE = 44;

const resolveLogoSource = async (logoUrl: string): Promise<string | Buffer | null> => {
  if (/^https?:\/\//i.test(logoUrl)) {
    const response = await axios.get<ArrayBuffer>(logoUrl, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  if (fs.existsSync(logoUrl)) {
    return logoUrl;
  }

  return null;
};

export const renderHeader = async (ctx: PdfContext): Promise<void> => {
  const { document } = ctx;
  const top = 18;
  const logoX = ctx.contentLeft;
  const logoY = top;
  const textX = logoX + HEADER_LOGO_SIZE + 14;
  const rightX = ctx.contentRight;

  document.save();

  if (ctx.organization.logoUrl) {
    try {
      const source = await resolveLogoSource(ctx.organization.logoUrl);
      if (source) {
        document.image(source, logoX, logoY, {
          fit: [HEADER_LOGO_SIZE, HEADER_LOGO_SIZE],
        });
      } else {
        document
          .lineWidth(1)
          .strokeColor(ctx.theme.colors.border)
          .rect(logoX, logoY, HEADER_LOGO_SIZE, HEADER_LOGO_SIZE)
          .stroke();
      }
    } catch {
      document
        .lineWidth(1)
        .strokeColor(ctx.theme.colors.border)
        .rect(logoX, logoY, HEADER_LOGO_SIZE, HEADER_LOGO_SIZE)
        .stroke();
    }
  } else {
    document
      .lineWidth(1)
      .strokeColor(ctx.theme.colors.border)
      .rect(logoX, logoY, HEADER_LOGO_SIZE, HEADER_LOGO_SIZE)
      .stroke();
  }

  document
    .fillColor(ctx.theme.colors.brandDark)
    .font(ctx.theme.fonts.bold)
    .fontSize(14)
    .text(ctx.organization.name, textX, logoY + 1, {
      width: ctx.contentWidth - HEADER_LOGO_SIZE - 160,
      ellipsis: true,
    });

  const addressLines = [ctx.organization.addressLine1, ctx.organization.addressLine2].filter(
    Boolean
  );

  document
    .fillColor(ctx.theme.colors.muted)
    .font(ctx.theme.fonts.regular)
    .fontSize(9)
    .text(addressLines.join('\n'), textX, logoY + 20, {
      width: ctx.contentWidth - HEADER_LOGO_SIZE - 160,
      lineGap: 2,
    });

  const contactLines = [
    ctx.organization.phone ? `Phone: ${ctx.organization.phone}` : undefined,
    ctx.organization.email ? `Email: ${ctx.organization.email}` : undefined,
  ].filter((value): value is string => Boolean(value));

  document
    .font(ctx.theme.fonts.regular)
    .fontSize(9)
    .fillColor(ctx.theme.colors.text)
    .text(contactLines.join('\n'), rightX - 150, logoY + 2, {
      width: 150,
      align: 'right',
      lineGap: 2,
    });

  document
    .moveTo(ctx.contentLeft, ctx.headerHeight - 2)
    .lineTo(ctx.contentRight, ctx.headerHeight - 2)
    .lineWidth(1)
    .strokeColor(ctx.theme.colors.border)
    .stroke();

  document.restore();
};
