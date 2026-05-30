import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { PaymentStatusContent } from './PaymentStatusContent';

export const metadata: Metadata = {
  title: 'Payment Status — Yosemite Crew',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PaymentStatusContent />
    </Suspense>
  );
}
