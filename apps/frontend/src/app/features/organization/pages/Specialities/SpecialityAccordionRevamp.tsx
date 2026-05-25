import React, { useId, useRef, useState } from 'react';
import type { ServicesTabHandle } from '@/app/features/organization/pages/Specialities/ServicesTab';
import type { PackagesTabHandle } from '@/app/features/organization/pages/Specialities/PackagesTab';
import { IoIosArrowDown } from 'react-icons/io';
import { IoIosSearch } from 'react-icons/io';
import { RiEdit2Line } from 'react-icons/ri';
import { MdOutlineArchive } from 'react-icons/md';
import { FiCheck, FiX } from 'react-icons/fi';
import TabToggle, { TabOption } from '@/app/ui/primitives/TabToggle/TabToggle';
import ServicesTab from '@/app/features/organization/pages/Specialities/ServicesTab';
import PackagesTab from '@/app/features/organization/pages/Specialities/PackagesTab';
import ArchiveTab from '@/app/features/organization/pages/Specialities/ArchiveTab';
import { SpecialityRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useShallow } from 'zustand/react/shallow';
import { useNotify } from '@/app/hooks/useNotify';
import Primary from '@/app/ui/primitives/Buttons/Primary';

type SpecialityAccordionRevampProps = {
  speciality: SpecialityRevamp;
  defaultOpen?: boolean;
};

type ActiveTab = 'services' | 'packages' | 'archive';

const TABS: TabOption[] = [
  { key: 'services', label: 'All Services' },
  { key: 'packages', label: 'All Packages' },
  { key: 'archive', label: 'Archive', icon: <MdOutlineArchive size={14} aria-hidden="true" /> },
];

const panelId = (key: string) => `panel-${key}`;

type SearchResult = {
  id: string;
  name: string;
  kind: 'service' | 'package';
  meta: string;
};

const SpecialityAccordionRevamp = ({
  speciality,
  defaultOpen = false,
}: SpecialityAccordionRevampProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<ActiveTab>('services');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(speciality.name);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const servicesTabRef = useRef<ServicesTabHandle>(null);
  const packagesTabRef = useRef<PackagesTabHandle>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const renameSpeciality = useRevampCatalogStore((s) => s.renameSpeciality);
  const serviceCount = useRevampCatalogStore(
    (s) =>
      s.services.filter((svc) => svc.specialityId === speciality.id && svc.status === 'ACTIVE')
        .length
  );
  const packageCount = useRevampCatalogStore(
    (s) =>
      s.packages.filter((pkg) => pkg.specialityId === speciality.id && pkg.status === 'ACTIVE')
        .length
  );

  const allServices = useRevampCatalogStore(
    useShallow((s) =>
      s.services.filter((svc) => svc.specialityId === speciality.id && svc.status === 'ACTIVE')
    )
  );
  const allPackages = useRevampCatalogStore(
    useShallow((s) =>
      s.packages.filter((pkg) => pkg.specialityId === speciality.id && pkg.status === 'ACTIVE')
    )
  );

  const { notify } = useNotify();
  const totalCount = serviceCount + packageCount;

  const nameInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const searchResults: SearchResult[] = searchQuery.trim()
    ? [
        ...allServices
          .filter(
            (s) =>
              s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              s.code.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((s) => ({
            id: s.id,
            name: s.name,
            kind: 'service' as const,
            meta: `${s.code} · ${s.type}`,
          })),
        ...allPackages
          .filter(
            (p) =>
              p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.code.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((p) => ({
            id: p.id,
            name: p.name,
            kind: 'package' as const,
            meta: `${p.code} · ${p.breakdown.length} items`,
          })),
      ]
    : [];

  const handleSearchSelect = (result: SearchResult) => {
    setSearchQuery('');
    setSearchOpen(false);
    if (!open) setOpen(true);
    setActiveTab(result.kind === 'package' ? 'packages' : 'services');
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(speciality.name);
    setEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveName = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    renameSpeciality(speciality.id, trimmed);
    notify('success', { title: 'Speciality renamed', text: `Renamed to "${trimmed}".` });
    setEditingName(false);
  };

  const handleCancelName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(speciality.name);
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSaveName(e);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setNameValue(speciality.name);
      setEditingName(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  return (
    <div className="flex flex-col w-full rounded-2xl border border-card-border">
      {/* Accordion Header — two rows on mobile, single row on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5">
        {/* Row 1 (always): chevron + name + rename icon */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            className="flex items-center gap-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand rounded"
            onClick={() => setOpen((p) => !p)}
            aria-expanded={open}
            aria-label={`${speciality.name} speciality`}
          >
            <IoIosArrowDown
              size={20}
              aria-hidden="true"
              className={`text-black-text transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
            />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label htmlFor={nameInputId} className="sr-only">
                  Speciality name
                </label>
                <input
                  ref={inputRef}
                  id={nameInputId}
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  className="flex-1 min-w-0 text-heading-3 text-text-primary bg-transparent border-b-2 border-input-border-active focus-visible:outline-none px-1"
                  aria-label="Edit speciality name"
                />
                <button
                  type="button"
                  aria-label="Save name"
                  onClick={handleSaveName}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-text-brand text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand shrink-0"
                >
                  <FiCheck size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel rename"
                  onClick={handleCancelName}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-card-border hover:border-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 transition-colors shrink-0"
                >
                  <FiX size={14} color="var(--color-danger-600)" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="text-heading-3 text-text-primary text-left truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand rounded"
                  onClick={() => setOpen((p) => !p)}
                >
                  <span className="truncate">{speciality.name}</span>{' '}
                  <span className="text-text-secondary font-normal whitespace-nowrap">
                    ({totalCount})
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${speciality.name}`}
                  onClick={handleEditClick}
                  className="flex items-center justify-center w-9 h-9 rounded-full border border-transparent hover:border-card-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand transition-colors shrink-0"
                >
                  <RiEdit2Line size={18} color="var(--color-neutral-700)" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2 on mobile / inline on sm+: primary button (left) + search (right) */}
        {!editingName && (
          <div className="flex items-center gap-2 flex-wrap w-full sm:flex-nowrap sm:w-auto min-h-12">
            {/* Primary button — leftmost, only when accordion is open and not on Archive tab */}
            {open && activeTab !== 'archive' && (
              <div className="shrink-0 w-full sm:w-auto">
                <Primary
                  href="#"
                  text={activeTab === 'packages' ? '+ New Package' : '+ New Service'}
                  onClick={(e) => {
                    e.preventDefault();
                    if (activeTab === 'packages') {
                      packagesTabRef.current?.openAdd();
                    } else {
                      servicesTabRef.current?.openAdd();
                    }
                  }}
                  className="w-full sm:w-auto"
                />
              </div>
            )}
            {/* Search bar — full width on mobile, fixed 256px + pushed right on sm+ */}
            <div ref={searchRef} className="relative w-full sm:w-64 sm:ml-auto shrink-0">
              <div className="flex items-center gap-2 border border-input-border-default rounded-2xl px-3.5 h-10.5 focus-within:border-input-border-active transition-colors bg-white w-full">
                <input
                  type="text"
                  placeholder="Search services & packages..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  onKeyDown={handleSearchKeyDown}
                  className="flex-1 min-w-0 bg-transparent font-satoshi text-[13px] font-medium text-text-primary focus-visible:outline-none placeholder:text-text-secondary"
                  aria-label={`Search within ${speciality.name}`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    className="shrink-0 focus-visible:outline-none"
                  >
                    <FiX size={12} color="var(--color-text-secondary)" />
                  </button>
                )}
                <IoIosSearch
                  size={20}
                  color="var(--color-neutral-900)"
                  aria-hidden="true"
                  className="shrink-0"
                />
              </div>

              {searchOpen && searchQuery.trim() && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 z-50 mt-1 w-full sm:w-96 bg-white border border-card-border rounded-2xl shadow-lg overflow-hidden">
                  {searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onMouseDown={() => handleSearchSelect(result)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-card-hover transition-colors"
                      >
                        <span className="text-body-4 text-text-primary truncate">
                          {result.name}
                        </span>
                        <span className="text-caption-1 text-text-secondary shrink-0">
                          {result.meta}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-body-4 text-text-secondary">
                      No results found.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-card-border">
          <TabToggle
            tabs={TABS}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as ActiveTab)}
            panelId={panelId}
          />

          <div className="px-5 pt-3">
            {activeTab === 'services' && (
              <div id={panelId('services')} role="tabpanel" aria-labelledby="tab-services">
                <ServicesTab
                  ref={servicesTabRef}
                  specialityId={speciality.id}
                  organisationId={speciality.organisationId}
                />
              </div>
            )}
            {activeTab === 'packages' && (
              <div id={panelId('packages')} role="tabpanel" aria-labelledby="tab-packages">
                <PackagesTab
                  ref={packagesTabRef}
                  specialityId={speciality.id}
                  organisationId={speciality.organisationId}
                />
              </div>
            )}
            {activeTab === 'archive' && (
              <div id={panelId('archive')} role="tabpanel" aria-labelledby="tab-archive">
                <ArchiveTab specialityId={speciality.id} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialityAccordionRevamp;
