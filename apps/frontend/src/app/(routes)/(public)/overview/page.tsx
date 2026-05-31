import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Overview — Yosemite Crew',
};

export default function Page() {
  redirect('/insights');
}
