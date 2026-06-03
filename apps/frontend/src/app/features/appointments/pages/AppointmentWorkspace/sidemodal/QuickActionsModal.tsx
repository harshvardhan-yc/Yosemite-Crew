'use client';
import React from 'react';
import Image from 'next/image';
import type { IconType } from 'react-icons';
import {
  LuActivity,
  LuClipboardList,
  LuFileText,
  LuMessageSquare,
  LuActivitySquare,
  LuX,
} from 'react-icons/lu';
import ModalBase from '@/app/ui/overlays/Modal/ModalBase';
import type { Appointment } from '@yosemite-crew/types';
import type { SideAction } from '@/app/features/appointments/types/workspace';
import RecordPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/RecordPanel';
import TasksPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/TasksPanel';
import DocumentsPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/DocumentsPanel';
import ChatPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/ChatPanel';
import ActivityPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/ActivityPanel';
import MsdPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/MsdPanel';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

type QuickActionsModalProps = {
  appointment: Appointment;
  appointmentId: string;
  activeAction: SideAction | null;
  onChangeAction: (action: SideAction) => void;
  onClose: () => void;
};

type NavItem = {
  key: SideAction;
  label: string;
  icon: IconType;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'RECORD', label: 'Record', icon: LuActivitySquare },
  { key: 'TASKS', label: 'Tasks', icon: LuClipboardList },
  { key: 'DOCUMENTS', label: 'Documents', icon: LuFileText },
  { key: 'CHAT', label: 'Chat', icon: LuMessageSquare },
  { key: 'ACTIVITY', label: 'Activity', icon: LuActivity },
];

/** MSD/Merck nav item — icon is the branded glyph, rendered separately. */
const MSD_LABEL = 'MSD';

const NavButton = ({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={`flex size-11 items-center justify-center rounded-full border transition-colors duration-150 ${
          active ? 'border-text-brand text-text-brand' : 'border-neutral-300 text-neutral-700'
        }`}
      >
        <Icon size={20} />
      </span>
      <span
        className={`text-[12px] leading-[120%] ${active ? 'font-bold text-text-brand' : 'font-medium text-neutral-700'}`}
      >
        {item.label}
      </span>
    </button>
  );
};

/**
 * Quick-actions side modal — a right-docked panel (reuses the shared `Modal`
 * overlay) with a top row of round icon tabs (Record / Tasks / Documents /
 * Chat / Activity / MSD). The active tab routes to its panel below.
 */
const QuickActionsModal = ({
  appointment,
  appointmentId,
  activeAction,
  onChangeAction,
  onClose,
}: QuickActionsModalProps) => {
  const open = activeAction != null;

  return (
    <ModalBase
      showModal={open}
      setShowModal={(next) => {
        if (!next) onClose();
      }}
      onClose={onClose}
      aria-labelledby="quick-actions-heading"
      overlayClassName={`fixed inset-0 z-[1100] backdrop-blur-[2px] transition-opacity duration-200 ease-in-out ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      overlayStyle={{ backgroundColor: 'var(--color-overlay-backdrop)' }}
      containerClassName={`fixed top-0 right-0 z-[1200] flex h-full w-[90%] flex-col bg-white p-4 shadow-xl transition-transform duration-200 ease-out sm:w-[440px] ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="quick-actions-heading" className="text-body-2 font-bold text-text-primary">
            Quick actions
          </h2>
          <button
            type="button"
            aria-label="Close quick actions"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none"
          >
            <LuX size={20} aria-hidden="true" />
          </button>
        </div>
        <nav
          aria-label="Quick actions"
          className="flex items-start justify-between gap-2 border-b border-card-border px-2 pb-4"
        >
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={activeAction === item.key}
              onClick={() => onChangeAction(item.key)}
            />
          ))}
          <button
            type="button"
            aria-pressed={activeAction === 'MSD'}
            onClick={() => onChangeAction('MSD')}
            className="flex flex-col items-center gap-1.5 focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className={`flex size-11 items-center justify-center rounded-full border transition-colors duration-150 ${
                activeAction === 'MSD'
                  ? 'border-text-brand bg-primary-100'
                  : 'border-neutral-300 bg-neutral-0'
              }`}
            >
              <Image
                src={MEDIA_SOURCES.futureAssets.msdLogoUrl}
                alt=""
                width={30}
                height={30}
                className="size-7 object-contain"
              />
            </span>
            <span
              className={`text-[12px] leading-[120%] ${
                activeAction === 'MSD'
                  ? 'font-bold text-text-brand'
                  : 'font-medium text-neutral-700'
              }`}
            >
              {MSD_LABEL}
            </span>
          </button>
        </nav>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {activeAction === 'RECORD' && <RecordPanel appointmentId={appointmentId} />}
          {activeAction === 'TASKS' && <TasksPanel appointmentId={appointmentId} />}
          {activeAction === 'DOCUMENTS' && (
            <DocumentsPanel appointmentId={appointmentId} companionId={appointment.companion.id} />
          )}
          {activeAction === 'CHAT' && <ChatPanel appointment={appointment} />}
          {activeAction === 'ACTIVITY' && <ActivityPanel appointment={appointment} />}
          {activeAction === 'MSD' && <MsdPanel appointment={appointment} />}
        </div>
      </div>
    </ModalBase>
  );
};

export default QuickActionsModal;
