import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { PaymentStatusContent } from '@/app/(routes)/(public)/payment-status/PaymentStatusContent';

export const metadata: Metadata = {
  title: 'Payment Status — Yosemite Crew',
};

export default function Page() {
  return (
    <Suspense>
      <PaymentStatusContent />
    </Suspense>
  );
}
