import React from 'react';
import { MdDeleteForever } from 'react-icons/md';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { PackageBreakdownItem } from '@/app/features/organization/types/revamp';
import { computePackageBreakdownItem } from '@/app/features/organization/services/revampMockData';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure',
  LAB: 'Diagnostics',
  INVENTORY: 'Inventory',
  MEDICATION: 'Medication',
  PACKAGE: 'Package',
};

type PackageBreakdownTableProps = {
  items: PackageBreakdownItem[];
  additionalDiscount: number;
  editable?: boolean;
  onRemoveItem?: (id: string) => void;
  onChangeQty?: (id: string, qty: number) => void;
  onChangeDiscount?: (id: string, discount: number) => void;
};

const NestedBreakdownTooltip = ({
  items,
  additionalDiscount,
}: {
  items: PackageBreakdownItem[];
  additionalDiscount: number;
}) => {
  const subtotal = items.reduce((sum, item) => {
    const { net } = computePackageBreakdownItem(item);
    return sum + net;
  }, 0);
  const afterAdditional = subtotal - (subtotal * additionalDiscount) / 100;

  return (
    <div style={{ minWidth: 360 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ opacity: 0.6 }}>
            <th style={{ textAlign: 'left', padding: '2px 6px' }}>#</th>
            <th style={{ textAlign: 'left', padding: '2px 6px' }}>Type</th>
            <th style={{ textAlign: 'left', padding: '2px 6px' }}>Name</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>Unit</th>
            <th style={{ textAlign: 'center', padding: '2px 6px' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>Disc.</th>
            <th style={{ textAlign: 'right', padding: '2px 6px' }}>Net</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const { net } = computePackageBreakdownItem(item);
            return (
              <tr key={item.id} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '3px 6px', opacity: 0.5 }}>{i + 1}.</td>
                <td style={{ padding: '3px 6px', opacity: 0.7 }}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </td>
                <td style={{ padding: '3px 6px' }}>{item.name}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                  $ {item.unitPrice.toFixed(2)}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>×{item.quantity}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', opacity: 0.7 }}>
                  {item.discount}%
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>$ {net.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {additionalDiscount > 0 && (
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <td
                colSpan={6}
                style={{ padding: '3px 6px', textAlign: 'right', opacity: 0.6, fontSize: 10 }}
              >
                Additional discount ({additionalDiscount}%)
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', opacity: 0.8 }}>
                - $ {((subtotal * additionalDiscount) / 100).toFixed(2)}
              </td>
            </tr>
          )}
          <tr style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <td
              colSpan={6}
              style={{ padding: '4px 6px', textAlign: 'right', opacity: 0.7, fontSize: 10 }}
            >
              Total
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>
              $ {afterAdditional.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const PackageBreakdownTable = ({
  items,
  additionalDiscount,
  editable = false,
  onRemoveItem,
  onChangeQty,
  onChangeDiscount,
}: PackageBreakdownTableProps) => {
  const afterItemDiscounts = items.reduce((sum, item) => {
    const { net } = computePackageBreakdownItem(item);
    return sum + net;
  }, 0);
  const additionalDiscountAmt = (afterItemDiscounts * additionalDiscount) / 100;
  const totalCost = afterItemDiscounts - additionalDiscountAmt;

  return (
    <div className="w-full overflow-x-auto -mx-1 px-1">
      <table className="min-w-full text-body-4 text-text-primary border-separate border-spacing-0">
        <colgroup>
          <col className="w-8" />
          <col className="w-28" />
          <col />
          <col className="w-28" />
          <col className="w-24" />
          <col className="w-28" />
          <col className="w-28" />
          <col className="w-28" />
          {editable && <col className="w-10" />}
        </colgroup>
        <thead>
          <tr className="text-caption-1 text-text-secondary border-b border-card-border">
            <th className="text-left px-3 py-3">#</th>
            <th className="text-left px-3 py-3">Type</th>
            <th className="text-left px-3 py-3">Name</th>
            <th className="text-right px-3 py-3 whitespace-nowrap">Unit price</th>
            <th className="text-center px-3 py-3">Qty.</th>
            <th className="text-right px-3 py-3 whitespace-nowrap">Gross amt.</th>
            <th className="text-right px-3 py-3 whitespace-nowrap">Discount %</th>
            <th className="text-right px-3 py-3">Amount</th>
            {editable && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const { gross, net } = computePackageBreakdownItem(item);
            const isPackage = item.type === 'PACKAGE';
            const hasNested = isPackage && item.nestedBreakdown && item.nestedBreakdown.length > 0;
            return (
              <tr key={item.id} className="border-t border-card-border">
                <td className="px-3 py-3 text-text-secondary">{i + 1}.</td>
                <td className="px-3 py-3 text-text-secondary">
                  {TYPE_LABELS[item.type] ?? item.type}
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-1.5">
                    {item.name}
                    {hasNested && (
                      <GlassTooltip
                        content={
                          <NestedBreakdownTooltip
                            items={item.nestedBreakdown!}
                            additionalDiscount={0}
                          />
                        }
                        side="right"
                        maxWidth={440}
                      >
                        <span className="cursor-default text-text-secondary hover:text-text-brand transition-colors">
                          <AiOutlineInfoCircle size={14} aria-hidden="true" />
                        </span>
                      </GlassTooltip>
                    )}
                  </span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  $ {item.unitPrice.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-center">
                  {editable ? (
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                        onChangeQty?.(item.id, v);
                      }}
                      className="w-20 text-center bg-transparent border border-input-border-default rounded-xl px-3 h-9 text-body-4 focus-visible:outline-none focus-visible:border-input-border-active"
                      aria-label={`Quantity for ${item.name}`}
                    />
                  ) : (
                    <span>×{item.quantity}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">$ {gross.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      max={item.maxDiscount ?? 100}
                      value={item.discount}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        const max = item.maxDiscount ?? 100;
                        const v = isNaN(raw) ? 0 : Math.min(max, Math.max(0, raw));
                        onChangeDiscount?.(item.id, v);
                      }}
                      className="w-24 text-right bg-transparent border border-input-border-default rounded-xl px-3 h-9 text-body-4 focus-visible:outline-none focus-visible:border-input-border-active"
                      aria-label={`Discount for ${item.name}`}
                    />
                  ) : (
                    <span>-{item.discount}%</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">$ {net.toFixed(2)}</td>
                {editable && (
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => onRemoveItem?.(item.id)}
                      className="flex items-center justify-center w-7 h-7 rounded-full border border-transparent hover:border-danger-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600"
                    >
                      <MdDeleteForever
                        size={16}
                        color="var(--color-danger-600)"
                        aria-hidden="true"
                      />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {additionalDiscount > 0 && (
            <tr className="border-t border-card-border">
              <td colSpan={7} className="px-3 py-2 text-right text-caption-1 text-text-secondary">
                Additional Discount ({additionalDiscount}%)
              </td>
              <td
                colSpan={editable ? 2 : 1}
                className="px-3 py-2 text-right text-text-brand whitespace-nowrap"
              >
                - $ {additionalDiscountAmt.toFixed(2)}
              </td>
            </tr>
          )}
          <tr className="border-t border-card-border">
            <td
              colSpan={7}
              className="px-3 pt-3 pb-2 text-right text-caption-1 text-text-secondary"
            >
              Total cost
            </td>
            <td colSpan={editable ? 2 : 1} className="px-3 pt-3 pb-2 text-right">
              {editable ? (
                <span className="text-body-4-emphasis text-text-brand whitespace-nowrap">
                  $ {totalCost.toFixed(2)}
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-2 justify-end rounded-2xl bg-[#E6F2FF] px-4 py-2 text-[16px] font-bold leading-[120%] text-[#006AE0] whitespace-nowrap"
                  style={{ minWidth: 120, height: 40 }}
                >
                  $ {totalCost.toFixed(2)}
                </span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default PackageBreakdownTable;
