'use strict';

import type { ControlledSubstanceLogbook, CsTransaction } from './controlled-substance';

export interface DeaInventoryReport {
  generatedAt: number;
  facilityName: string;
  deaNumber: string;
  period: { start: string; end: string };
  drugs: DeaDrugEntry[];
  totalDrugs: number;
}

export interface DeaDrugEntry {
  drugName: string;
  drugClass: string;
  schedule: string;
  beginningInventory: number;
  received: number;
  dispensed: number;
  administered: number;
  wasted: number;
  transferIn: number;
  transferOut: number;
  endingInventory: number;
  transactions: CsTransaction[];
}

interface DeaDeps {
  logbook: ControlledSubstanceLogbook;
  facilityName?: string;
  deaNumber?: string;
  now?: () => number;
}

const SCHEDULE_MAP: Record<string, string> = {
  CII: 'II',
  CIII: 'III',
  CIV: 'IV',
  CV: 'V',
};

export const generateDeaReport = (deps: DeaDeps): DeaInventoryReport => {
  const now = deps.now || (() => Date.now());
  const endDate = new Date(now());
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - 2);

  const startStr = startDate.toISOString().split('T')[0] || '';
  const endStr = endDate.toISOString().split('T')[0] || '';
  const startTs = startDate.getTime();
  const endTs = endDate.getTime();

  const allTx = deps.logbook
    .getTransactions({ since: startTs })
    .filter((tx) => tx.timestamp <= endTs);

  const byDrug = new Map<string, CsTransaction[]>();
  for (const tx of allTx) {
    if (!byDrug.has(tx.drugName)) byDrug.set(tx.drugName, []);
    byDrug.get(tx.drugName)!.push(tx);
  }

  const drugs: DeaDrugEntry[] = [];
  for (const [drugName, txs] of byDrug) {
    const drugClass = txs[0]?.drugClass || 'CIII';
    const beginningInventory = 0;
    let received = 0;
    let dispensed = 0;
    let administered = 0;
    let wasted = 0;
    let transferIn = 0;
    let transferOut = 0;

    for (const tx of txs) {
      switch (tx.action) {
        case 'receive':
          received += tx.quantity;
          break;
        case 'dispense':
          dispensed += tx.quantity;
          break;
        case 'administer':
          administered += tx.quantity;
          break;
        case 'waste':
          wasted += tx.quantity;
          break;
        case 'transfer':
          if (tx.quantity > 0) transferIn += tx.quantity;
          else transferOut += Math.abs(tx.quantity);
          break;
      }
    }

    const endingInventory =
      beginningInventory + received + transferIn - dispensed - administered - wasted - transferOut;

    drugs.push({
      drugName,
      drugClass,
      schedule: SCHEDULE_MAP[drugClass] || 'III',
      beginningInventory,
      received,
      dispensed,
      administered,
      wasted,
      transferIn,
      transferOut,
      endingInventory,
      transactions: txs.sort((a, b) => a.timestamp - b.timestamp),
    });
  }

  drugs.sort((a, b) => a.drugName.localeCompare(b.drugName));

  return {
    generatedAt: now(),
    facilityName: deps.facilityName || 'Unnamed Facility',
    deaNumber: deps.deaNumber || 'Unknown',
    period: { start: startStr, end: endStr },
    drugs,
    totalDrugs: drugs.length,
  };
};

const pad = (s: string, len: number): string => s.padEnd(len);

const formatLine = (cells: string[], widths: number[]): string =>
  cells.map((c, i) => pad(c, widths[i] ?? 10)).join(' | ');

export type ReportFormat = 'json' | 'csv' | 'text' | 'pdf';

export const formatDeaReport = (report: DeaInventoryReport, format: ReportFormat): string => {
  if (format === 'json') return JSON.stringify(report, null, 2);

  if (format === 'csv') {
    const lines: string[] = [
      'Drug Name,Class,Schedule,Beginning Inventory,Received,Dispensed,Administered,Wasted,Transfer In,Transfer Out,Ending Inventory',
    ];
    for (const drug of report.drugs) {
      lines.push(
        [
          drug.drugName,
          drug.drugClass,
          drug.schedule,
          drug.beginningInventory,
          drug.received,
          drug.dispensed,
          drug.administered,
          drug.wasted,
          drug.transferIn,
          drug.transferOut,
          drug.endingInventory,
        ].join(',')
      );
    }
    return lines.join('\n');
  }

  if (format === 'text') {
    const widths = [20, 8, 8, 8, 10, 10, 10, 8, 10, 8];
    const header = [
      'Drug',
      'Schedule',
      'Begin',
      'Received',
      'Dispensed',
      'Admin',
      'Wasted',
      'Tr In',
      'Tr Out',
      'End',
    ];
    const sep = widths.map((w) => '-'.repeat(w)).join(' | ');
    const lines: string[] = [
      `DEA Biennial Inventory Report`,
      `Facility: ${report.facilityName}`,
      `DEA #: ${report.deaNumber}`,
      `Period: ${report.period.start} — ${report.period.end}`,
      `Generated: ${new Date(report.generatedAt).toISOString()}`,
      '',
      formatLine(header, widths),
      sep,
    ];
    for (const drug of report.drugs) {
      lines.push(
        formatLine(
          [
            drug.drugName,
            drug.schedule,
            String(drug.beginningInventory),
            String(drug.received),
            String(drug.dispensed),
            String(drug.administered),
            String(drug.wasted),
            String(drug.transferIn),
            String(drug.transferOut),
            String(drug.endingInventory),
          ],
          widths
        )
      );
    }
    lines.push('', `Total controlled substances tracked: ${report.totalDrugs}`);
    return lines.join('\n');
  }

  return JSON.stringify(report, null, 2);
};
