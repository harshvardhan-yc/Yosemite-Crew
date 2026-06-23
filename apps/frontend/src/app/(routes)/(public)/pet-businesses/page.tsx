import React from 'react';
import type { Metadata } from 'next';
import HomePage from '@/app/features/marketing/pages/HomePage/HomePage';

export const metadata: Metadata = {
  title: 'Pet Businesses — Yosemite Crew',
  description:
    'Everything you need to run your pet business — appointments, records, billing, and more.',
};

function page() {
  return <HomePage />;
}

export default page;
