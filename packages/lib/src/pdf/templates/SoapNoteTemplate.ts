import type { PdfContext } from '../PdfContext.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import {
  renderDocumentTitle,
  renderParagraph,
  renderSectionTitle,
  renderSpacer,
} from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import type { ClinicalPdfSignaturePlacement, SoapNoteDocumentData } from '../types.js';
import { buildKeyValue, formatDateValue } from './shared.js';

export const renderSoapNoteTemplate = (
  ctx: PdfContext,
  data: SoapNoteDocumentData
): ClinicalPdfSignaturePlacement => {
  renderDocumentTitle(ctx, data.title);
  renderKeyValueGrid(
    ctx,
    buildKeyValue([
      ['Date', formatDateValue(data.date)],
      ['Appointment ID', data.appointmentId],
      ['Doctor', data.doctorName],
      ['Patient', data.patientName],
      ['Species / Breed', data.speciesBreed],
      ['Age / Sex', data.ageSex],
      ['Client', data.clientName],
      ['Client ID', data.clientId],
    ]),
    { columns: 2 }
  );
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);

  renderSectionTitle(ctx, 'Subjective');
  renderParagraph(ctx, data.subjective);

  renderSectionTitle(ctx, 'Objective');
  renderParagraph(ctx, data.objective);

  renderSectionTitle(ctx, 'Assessment');
  renderParagraph(ctx, data.assessment);

  renderSectionTitle(ctx, 'Plan');
  renderParagraph(ctx, data.plan);

  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  return renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
