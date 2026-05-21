'use client';
import React from 'react';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';
import CalEmbedFrame from '@/app/ui/overlays/CalEmbedFrame';

const BookOnboarding = () => {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 w-fit text-body-4 text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Go back"
      >
        <IoArrowBack size={18} />
        <span>Back</span>
      </button>
      <CalEmbedFrame
        calLink="yosemitecrew/onboarding"
        title="Book onboarding call"
        className="min-h-[calc(100vh-120px)] w-full border-0"
      />
    </div>
  );
};

const ProtectedBookOnboarding = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <BookOnboarding />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedBookOnboarding;
