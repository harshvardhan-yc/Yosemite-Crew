import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Specialities — Yosemite Crew' };
import React from 'react';
import dynamic from 'next/dynamic';

const SpecialitiesRevamp = dynamic(
  () => import('@/app/features/organization/pages/Specialities/SpecialitiesRevamp'),
  {
    loading: () => <div className="min-h-[50vh]" aria-hidden="true" />,
  }
);

function page() {
  return <SpecialitiesRevamp />;
}

export default page;
