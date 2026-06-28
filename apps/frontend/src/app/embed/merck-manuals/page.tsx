import type { Metadata } from 'next';
import React from 'react';
import { EmbeddedMerckManuals } from '@/app/features/integrations/pages/MerckManuals';

export const metadata: Metadata = {
  title: 'MSD Veterinary Manual — Yosemite Crew',
  description: 'Embedded MSD Veterinary Manual reference for veterinary professionals.',
};

function page() {
  return <EmbeddedMerckManuals />;
}

export default page;
