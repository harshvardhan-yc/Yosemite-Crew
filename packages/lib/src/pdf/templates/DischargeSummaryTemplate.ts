import type { PdfContext } from '../PdfContext.js';
import { renderBulletList } from '../sections/BulletList.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import {
  renderDocumentTitle,
  renderParagraph,
  renderSectionTitle,
  renderSpacer,
} from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import type { ClinicalPdfSignaturePlacement, DischargeSummaryDocumentData } from '../types.js';
import { buildKeyValue, formatDateValue } from './shared.js';

export const renderDischargeSummaryTemplate = (
  ctx: PdfContext,
  data: DischargeSummaryDocumentData
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
      ['Contact', data.contact],
    ]),
    { columns: 2 }
  );
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);

  renderSectionTitle(ctx, 'Chief Complaint');
  renderParagraph(ctx, data.chiefComplaint);

  renderSectionTitle(ctx, 'Treatment Summary');
  renderParagraph(ctx, data.treatmentSummary);

  renderSectionTitle(ctx, 'Procedures');
  renderBulletList(ctx, data.procedures);

  renderSectionTitle(ctx, 'Diagnostics');
  renderBulletList(ctx, data.diagnostics);

  renderSectionTitle(ctx, 'Discharge Summary');
  renderParagraph(ctx, data.dischargeSummary);

  renderSectionTitle(ctx, 'Home Care');
  renderBulletList(ctx, data.homeCare);

  renderSectionTitle(ctx, 'Emergency Care');
  renderBulletList(ctx, data.emergencyCare);

  renderSectionTitle(ctx, 'Emergency Contact');
  renderParagraph(ctx, data.emergencyContact);

  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  return renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
