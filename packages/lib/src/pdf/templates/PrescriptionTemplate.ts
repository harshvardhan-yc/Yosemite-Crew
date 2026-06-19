import type { PdfContext } from '../PdfContext.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import {
  renderDocumentTitle,
  renderParagraph,
  renderSectionTitle,
  renderSpacer,
} from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import { renderTable } from '../sections/Table.js';
import type { PrescriptionDocumentData } from '../types.js';
import { buildKeyValue, formatDateValue } from './shared.js';

export const renderPrescriptionTemplate = (
  ctx: PdfContext,
  data: PrescriptionDocumentData
): void => {
  renderDocumentTitle(ctx, data.title);
  renderKeyValueGrid(
    ctx,
    buildKeyValue([
      ['Date', formatDateValue(data.date)],
      ['Prescription ID', data.prescriptionId],
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

  renderSectionTitle(ctx, 'Medication Details');
  renderTable(ctx, {
    columns: [
      { header: 'Medication', width: 0.18 },
      { header: 'Strength', width: 0.12 },
      { header: 'Dosage', width: 0.12 },
      { header: 'Frequency', width: 0.12 },
      { header: 'Duration', width: 0.12 },
      { header: 'Qty', width: 0.08, align: 'right' },
      { header: 'Instructions', width: 0.26 },
    ],
    rows: data.items.map((item) => [
      item.medication,
      item.strength ?? '',
      item.dosage ?? '',
      item.frequency ?? '',
      item.duration ?? '',
      item.quantity ?? '',
      item.instructions ?? '',
    ]),
  });

  if (data.notes) {
    renderSectionTitle(ctx, 'Notes');
    renderParagraph(ctx, data.notes);
  }

  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
