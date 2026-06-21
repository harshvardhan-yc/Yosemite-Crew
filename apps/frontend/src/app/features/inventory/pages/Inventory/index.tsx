'use client';
import React, { Suspense, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import InventoryTurnoverFilters from '@/app/ui/filters/InventoryTurnoverFilters';
import {
  AbcClassOptions,
  CategoryOptionsByBusiness,
  InventoryFiltersState,
  InventoryItem,
  InventoryTurnoverItem,
  SubCategoryOptions,
  SubCategoryByCategory,
} from '@/app/features/inventory/pages/Inventory/types';
import { defaultFilters } from '@/app/features/inventory/pages/Inventory/utils';
import { InventorySectionKey } from '@/app/features/inventory/components/AddInventory/InventoryConfig';
import { BusinessType, BusinessTypes } from '@/app/features/organization/types/org';
import { useOrgStore } from '@/app/stores/orgStore';
import { useLoadOrg } from '@/app/hooks/useLoadOrg';
import { useInventoryModule } from '@/app/hooks/useInventory';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useSearchStore } from '@/app/stores/searchStore';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';
import Modal from '@/app/ui/overlays/Modal';
import { Primary } from '@/app/ui/primitives/Buttons';
import { FiCheck, FiFilter, FiPlus, FiSearch, FiSliders, FiX } from 'react-icons/fi';

const INVENTORY_PAGE_SKELETON = <PageSkeleton variant="list" />;

const InventorySectionSkeleton = () => (
  <div className="h-full min-h-125 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const InventoryTable = dynamic(() => import('@/app/ui/tables/InventoryTable'), {
  loading: () => <InventorySectionSkeleton />,
});
const InventoryTurnoverTable = dynamic(() => import('@/app/ui/tables/InventoryTurnoverTable'), {
  loading: () => <InventorySectionSkeleton />,
});
const AddInventory = dynamic(() => import('@/app/features/inventory/components/AddInventory'));
const InventoryInfo = dynamic(() =>
  import('@/app/features/inventory/components').then((module) => ({
    default: module.InventoryInfo,
  }))
);

type InventoryView = 'inventory' | 'turnover';

const toggleArrayValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

type SortMode = 'name' | 'expiry' | 'stock';

const getNextSortMode = (current: SortMode): SortMode => {
  if (current === 'name') return 'expiry';
  if (current === 'expiry') return 'stock';
  return 'name';
};

const compareInventoryRows = (a: InventoryItem, b: InventoryItem, sortMode: SortMode): number => {
  if (sortMode === 'expiry') {
    return String(a.batch.expiryDate ?? '').localeCompare(String(b.batch.expiryDate ?? ''));
  }
  if (sortMode === 'stock') {
    return Number(a.stock.current ?? 0) - Number(b.stock.current ?? 0);
  }
  return a.basicInfo.name.localeCompare(b.basicInfo.name);
};

const getVisibilityLabel = (visibility: 'ALL' | 'ACTIVE' | 'HIDDEN'): string => {
  if (visibility === 'ALL') return 'All';
  if (visibility === 'ACTIVE') return 'Visible';
  return 'Hidden';
};

const getSupplierName = (item: InventoryItem) =>
  (item.vendor?.supplierName || item.vendor?.vendor || '').trim();

const Inventory = () => {
  useLoadOrg();

  const permissions = usePermissions();
  const canEditInventory = permissions.can(PERMISSIONS.INVENTORY_EDIT_ANY);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const orgsById = useOrgStore((s) => s.orgsById);
  const primaryOrg = primaryOrgId ? orgsById[primaryOrgId] : null;
  const rooms = useRoomsForPrimaryOrg();
  const headerSearchQuery = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);

  const [businessType, setBusinessType] = useState<BusinessType | null>(primaryOrg?.type ?? null);
  const resolvedBusinessType: BusinessType = businessType ?? 'GROOMER';

  const inventoryModule = useInventoryModule(resolvedBusinessType);
  const { inventory, turnover, status, error: loadError } = inventoryModule;

  const [filters, setFilters] = useState<InventoryFiltersState>(defaultFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(headerSearchQuery);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [filteredTurnoverList, setFilteredTurnoverList] = useState<InventoryTurnoverItem[]>([]);
  const [addPopup, setAddPopup] = useState(false);
  const [viewInventory, setViewInventory] = useState(false);
  const [infoInitialSection, setInfoInitialSection] = useState<InventorySectionKey | undefined>(
    undefined
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeInventory, setActiveInventory] = useState<InventoryItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<InventoryView>('inventory');
  const [sortMode, setSortMode] = useState<'name' | 'expiry' | 'stock'>('name');
  const { plannerSectionRef } = usePlannerAutoLock({ activeView: 'list', topOffset: 72 });

  const loadingList = status === 'loading';
  const error = actionError ?? loadError;

  useEffect(() => {
    const org = primaryOrgId ? orgsById[primaryOrgId] : null;
    if (org?.type && BusinessTypes.includes(org.type)) {
      setBusinessType(org.type);
    } else if (businessType === null) {
      setBusinessType('GROOMER');
    }
  }, [primaryOrgId, orgsById, businessType]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search || headerSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [headerSearchQuery, filters.search]);

  const categoryOptions = useMemo(() => {
    const configured = CategoryOptionsByBusiness[resolvedBusinessType] ?? [];
    const fromItems = inventory
      .map((item) => item.basicInfo.category?.trim())
      .filter((category): category is string => Boolean(category));
    return Array.from(new Set([...configured, ...fromItems]));
  }, [resolvedBusinessType, inventory]);

  const stockLocationOptions = useMemo(() => {
    const roomNames = rooms
      .map((room) => room?.name?.trim())
      .filter((name): name is string => Boolean(name));
    return roomNames.length > 0 ? Array.from(new Set(roomNames)) : undefined;
  }, [rooms]);

  const locationFilterOptions = useMemo(() => {
    const fromItems = inventory
      .map((item) => item.stock?.stockLocation?.trim())
      .filter((location): location is string => Boolean(location));
    return Array.from(new Set([...(stockLocationOptions ?? []), ...fromItems]));
  }, [inventory, stockLocationOptions]);

  const supplierFilterOptions = useMemo(() => {
    const suppliers = new Set<string>();
    inventory.forEach((item) => {
      const supplier = getSupplierName(item);
      if (supplier) suppliers.add(supplier);
    });
    return Array.from(suppliers);
  }, [inventory]);

  const categorySubcategoryOptions = useMemo(() => {
    return categoryOptions.reduce<Record<string, string[]>>((acc, category) => {
      const configured = SubCategoryByCategory[category] ?? [];
      const fromItems = inventory.reduce<string[]>((subCategories, item) => {
        const subCategory = item.basicInfo.subCategory?.trim();
        if (item.basicInfo.category === category && subCategory) {
          subCategories.push(subCategory);
        }
        return subCategories;
      }, []);
      const fallback = configured.length > 0 ? configured : SubCategoryOptions.slice(0, 6);
      acc[category] = Array.from(new Set([...fallback, ...fromItems]));
      return acc;
    }, {});
  }, [categoryOptions, inventory]);

  const turnoverCategoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        turnover
          .map((item) => item.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    );
  }, [turnover]);
  const { wrapperClassName, plannerSectionClassName } = getPlannerLayoutClassNames({
    activeView: 'list',
    listWrapperClassName:
      'w-full flex flex-col gap-4 h-[calc(100vh-236px)] min-h-[540px] max-h-[calc(100vh-236px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-104px)] lg:min-h-[calc(100dvh-104px)] lg:max-h-[calc(100dvh-104px)]',
    plannerClassName: '',
  });

  useEffect(() => {
    setFilteredTurnoverList(turnover);
  }, [turnover]);

  useEffect(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    const visibilityFilter = (filters.visibility ?? 'ALL').toUpperCase();
    const stockHealthFilter = filters.status.toUpperCase();
    const selectedCategories = filters.categories ?? [];
    const selectedSubCategories = filters.subCategories ?? [];
    const selectedLocations = filters.locations ?? [];
    const selectedAbcClasses = filters.abcClasses ?? [];
    const selectedSuppliers = filters.suppliers ?? [];
    const nextFiltered = inventory.filter((item) => {
      const statusKey = (item.status || item.basicInfo.status || '').toUpperCase();
      const stockHealthKey = (item.stockHealth || '').toUpperCase().replaceAll(' ', '_');
      const categoryMatch =
        (filters.category === 'all' && selectedCategories.length === 0) ||
        selectedCategories.includes(item.basicInfo.category ?? '') ||
        item.basicInfo.category?.toLowerCase() === filters.category.toLowerCase();
      const subCategoryMatch =
        selectedSubCategories.length === 0 ||
        selectedSubCategories.includes(item.basicInfo.subCategory ?? '');
      const locationMatch =
        selectedLocations.length === 0 ||
        selectedLocations.includes(item.stock?.stockLocation ?? '');
      const abcClassMatch =
        selectedAbcClasses.length === 0 || selectedAbcClasses.includes(item.stock?.abcClass ?? '');
      const supplierMatch =
        selectedSuppliers.length === 0 || selectedSuppliers.includes(getSupplierName(item));
      const visibilityMatch = visibilityFilter === 'ALL' || statusKey === visibilityFilter;
      const stockHealthMatch = stockHealthFilter === 'ALL' || stockHealthKey === stockHealthFilter;
      const searchMatch =
        normalizedSearch === '' ||
        item.basicInfo.name.toLowerCase().includes(normalizedSearch) ||
        item.basicInfo.category?.toLowerCase().includes(normalizedSearch) ||
        item.basicInfo.subCategory?.toLowerCase().includes(normalizedSearch) ||
        item.batch?.batch?.toLowerCase().includes(normalizedSearch) ||
        item.basicInfo.description?.toLowerCase().includes(normalizedSearch);
      return (
        categoryMatch &&
        subCategoryMatch &&
        locationMatch &&
        abcClassMatch &&
        supplierMatch &&
        visibilityMatch &&
        stockHealthMatch &&
        searchMatch
      );
    });
    nextFiltered.sort((a, b) => compareInventoryRows(a, b, sortMode));
    setFilteredInventory(nextFiltered);
  }, [
    inventory,
    filters.category,
    filters.categories,
    filters.subCategories,
    filters.locations,
    filters.abcClasses,
    filters.suppliers,
    filters.visibility,
    filters.status,
    debouncedSearch,
    sortMode,
  ]);

  useEffect(() => {
    setActiveInventory((prev) => {
      if (!filteredInventory.length) return null;
      if (prev) {
        const existing = filteredInventory.find((i) => i.id === prev.id);
        if (existing) return existing;
      }
      return filteredInventory[0];
    });
    if (!filteredInventory.length) {
      setViewInventory(false);
    }
  }, [filteredInventory]);

  useEffect(() => {
    const inventoryId = String(searchParams.get('inventoryId') ?? '').trim();
    if (!inventoryId) return;
    if (handledDeepLinkRef.current === inventoryId) return;

    const target = inventory.find((item) => item.id === inventoryId);
    if (target === undefined) return;

    setActiveInventory(target);
    setInfoInitialSection(undefined);
    setViewInventory(true);
    handledDeepLinkRef.current = inventoryId;
  }, [inventory, searchParams]);

  const handleCreateInventory = useCallback(
    async (data: InventoryItem) => {
      if (!primaryOrgId) {
        throw new Error('No organisation selected.');
      }
      setSavingItem(true);
      setActionError(null);
      try {
        const created = await inventoryModule.createItem(data);
        setActiveInventory(created);
        setAddPopup(false);
      } catch (err) {
        setActionError('Unable to save inventory item.');
        throw err;
      } finally {
        setSavingItem(false);
      }
    },
    [primaryOrgId, inventoryModule]
  );

  const handleUpdateInventory = useCallback(
    async (updatedItem: InventoryItem) => {
      if (!updatedItem.id) return;
      setActionError(null);
      try {
        const mapped = await inventoryModule.updateItem(updatedItem);
        setActiveInventory(mapped);
      } catch (err) {
        setActionError('Unable to update inventory item.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleAddBatch = useCallback(
    async (itemId: string, batches: any[]) => {
      if (!itemId) return;
      setActionError(null);
      try {
        await inventoryModule.addBatch(itemId, batches);
      } catch (err) {
        setActionError('Unable to add batch.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleUpdateBatch = useCallback(
    async (itemId: string, batches: any[]) => {
      if (!itemId) return;
      setActionError(null);
      try {
        await inventoryModule.updateBatch(itemId, batches);
      } catch (err) {
        setActionError('Unable to update batch.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleHideInventory = useCallback(
    async (itemId: string) => {
      if (!itemId) return;
      setActionError(null);
      try {
        const res = await inventoryModule.hideItem(itemId);
        if (res !== undefined) {
          setActiveInventory(res);
        }
      } catch (err) {
        setActionError('Unable to hide inventory item.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleUnhideInventory = useCallback(
    async (itemId: string) => {
      if (!itemId) return;
      setActionError(null);
      try {
        const res = await inventoryModule.unhideItem(itemId);
        if (res !== undefined) {
          setActiveInventory(res);
        }
      } catch (err) {
        setActionError('Unable to unhide inventory item.');
        throw err;
      }
    },
    [inventoryModule]
  );

  const handleRestock = useCallback((item: InventoryItem) => {
    setActiveInventory(item);
    setInfoInitialSection('stock');
    setViewInventory(true);
  }, []);

  const toggleCategoryFilter = useCallback(
    (category: string) => {
      setFilters((prev) => {
        const categories = toggleArrayValue(prev.categories ?? [], category);
        const categorySubcategories = categorySubcategoryOptions[category] ?? [];
        const subCategories = categories.includes(category)
          ? prev.subCategories
          : prev.subCategories.filter(
              (subCategory) => !categorySubcategories.includes(subCategory)
            );
        return {
          ...prev,
          category: categories.length === 1 ? categories[0] : 'all',
          categories,
          subCategories,
        };
      });
    },
    [categorySubcategoryOptions]
  );

  const toggleListFilter = useCallback(
    (key: 'subCategories' | 'locations' | 'abcClasses' | 'suppliers', value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: toggleArrayValue(prev[key] ?? [], value),
      }));
    },
    []
  );

  const selectedFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (filters.status !== 'ALL') {
      chips.push({
        id: `status-${filters.status}`,
        label: filters.status.replaceAll('_', ' ').toLowerCase(),
        onRemove: () => setFilters((prev) => ({ ...prev, status: 'ALL' })),
      });
    }
    (filters.categories ?? []).forEach((category) =>
      chips.push({
        id: `category-${category}`,
        label: category,
        onRemove: () => toggleCategoryFilter(category),
      })
    );
    (filters.subCategories ?? []).forEach((subCategory) =>
      chips.push({
        id: `subCategory-${subCategory}`,
        label: subCategory,
        onRemove: () => toggleListFilter('subCategories', subCategory),
      })
    );
    (filters.locations ?? []).forEach((location) =>
      chips.push({
        id: `location-${location}`,
        label: location,
        onRemove: () => toggleListFilter('locations', location),
      })
    );
    (filters.abcClasses ?? []).forEach((abcClass) =>
      chips.push({
        id: `abcClass-${abcClass}`,
        label: abcClass,
        onRemove: () => toggleListFilter('abcClasses', abcClass),
      })
    );
    (filters.suppliers ?? []).forEach((supplier) =>
      chips.push({
        id: `supplier-${supplier}`,
        label: supplier,
        onRemove: () => toggleListFilter('suppliers', supplier),
      })
    );
    if (filters.category !== 'all' && !(filters.categories ?? []).includes(filters.category)) {
      chips.push({
        id: `categorySingle-${filters.category}`,
        label: filters.category,
        onRemove: () => setFilters((prev) => ({ ...prev, category: 'all' })),
      });
    }
    if (filters.visibility !== 'ALL') {
      chips.push({
        id: `visibility-${filters.visibility}`,
        label: filters.visibility === 'ACTIVE' ? 'Visible' : 'Hidden',
        onRemove: () => setFilters((prev) => ({ ...prev, visibility: 'ALL' })),
      });
    }
    return chips;
  }, [filters, toggleCategoryFilter, toggleListFilter]);

  return (
    <div className="relative min-w-0 flex h-full min-h-0 flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-3! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-3!">
      <div className="flex justify-between items-center w-full flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-text-primary text-heading-2 flex items-center gap-2">
            <span>Inventory</span>
            <GlassTooltip
              content="Organize stock, track batches and expiry, and monitor turnover so you know what to reorder and which items need attention."
              side="bottom"
            >
              <button
                type="button"
                aria-label="Inventory info"
                className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </h1>
        </div>
        <div className="ml-auto flex items-center justify-end gap-3 flex-wrap">
          {canEditInventory && (
            <Primary
              href="#"
              text={savingItem ? 'Saving...' : 'Add item'}
              onClick={() => setAddPopup(true)}
              isDisabled={savingItem || !primaryOrgId}
              icon={<FiPlus size={18} aria-hidden="true" />}
              className="h-11!"
            />
          )}
          <button
            type="button"
            onClick={() => setActiveView(activeView === 'turnover' ? 'inventory' : 'turnover')}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-text-primary bg-white px-4 text-body-3-emphasis text-text-primary"
          >
            {activeView === 'turnover' ? 'Stock' : 'Turnover'}
          </button>
        </div>
      </div>

      <MobileSearchBar placeholder="Search inventory" />
      {error && <div className="text-red-500 text-sm font-satoshi font-semibold">{error}</div>}

      <PermissionGate allOf={[PERMISSIONS.INVENTORY_VIEW_ANY]} fallback={<Fallback />}>
        <div className={wrapperClassName}>
          <div className="flex w-full shrink-0 flex-col gap-4">
            {activeView === 'inventory' ? (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFilterOpen(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-card-border bg-white px-4 text-body-4 text-text-primary"
                  >
                    <FiSliders size={18} aria-hidden="true" />
                    <span>Filter</span>
                    {selectedFilterChips.length > 0 && (
                      <span className="rounded-full bg-badge-blue-bg px-2 text-caption-1 text-badge-blue-text">
                        {selectedFilterChips.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode((prev) => getNextSortMode(prev))}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-card-border bg-white px-4 text-body-4 text-text-primary"
                  >
                    <FiFilter size={18} aria-hidden="true" />
                    <span>Sort by</span>
                  </button>
                </div>
                <div className="relative w-full xl:max-w-100">
                  <FiSearch
                    size={18}
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                  />
                  <input
                    aria-label="Search inventory"
                    value={filters.search}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, search: event.target.value }))
                    }
                    placeholder="Search by item name, category, batch..."
                    className="h-11 w-full rounded-2xl border border-card-border bg-white pl-11 pr-4 text-body-4 text-text-primary outline-none focus:border-input-border-active"
                  />
                </div>
              </div>
            ) : (
              <InventoryTurnoverFilters
                list={turnover}
                setFilteredList={setFilteredTurnoverList}
                categories={turnoverCategoryOptions}
              />
            )}
          </div>

          {loadingList && activeView === 'inventory' && (
            <div className="text-grey-noti text-sm font-satoshi">Loading inventory…</div>
          )}

          <div ref={plannerSectionRef} className={plannerSectionClassName}>
            {activeView === 'inventory' ? (
              <InventoryTable
                setActiveInventory={setActiveInventory}
                setViewInventory={setViewInventory}
                onView={(item) => {
                  setActiveInventory(item);
                  setInfoInitialSection(undefined);
                  setViewInventory(true);
                }}
                filteredList={filteredInventory}
                onRestock={handleRestock}
              />
            ) : (
              <InventoryTurnoverTable filteredList={filteredTurnoverList} />
            )}
          </div>
        </div>

        <AddInventory
          showModal={addPopup}
          setShowModal={setAddPopup}
          businessType={resolvedBusinessType}
          onSubmit={handleCreateInventory}
          stockLocationOptions={stockLocationOptions}
        />

        {filterOpen && (
          <Modal showModal={filterOpen} setShowModal={setFilterOpen}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 pb-5">
                <div className="flex items-center gap-2 text-body-3-emphasis text-text-primary">
                  <FiSliders size={18} aria-hidden="true" />
                  <span>Filter</span>
                </div>
                {selectedFilterChips.length > 0 && (
                  <button
                    type="button"
                    className="rounded-full border border-blue-text px-4 py-1.5 text-body-4 text-blue-text transition-colors hover:bg-blue-light"
                    onClick={() => setFilters(defaultFilters)}
                  >
                    Clear all
                  </button>
                )}
              </div>
              {selectedFilterChips.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-5">
                  {selectedFilterChips.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-badge-blue-bg py-1 pl-3 pr-2 text-caption-1 capitalize text-badge-blue-text"
                    >
                      {chip.label}
                      <button
                        type="button"
                        aria-label={`Remove ${chip.label} filter`}
                        onClick={chip.onRemove}
                        className="inline-flex size-4 items-center justify-center rounded-full text-badge-blue-text transition-colors hover:bg-badge-blue-text/15"
                      >
                        <FiX size={13} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
                <div className="flex flex-col gap-2 border-b border-card-border pb-4">
                  <div className="text-body-4-emphasis text-text-primary">Stock status</div>
                  {['ALL', 'LOW_STOCK', 'EXPIRED', 'OUT_OF_STOCK'].map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-3 text-body-4 text-text-primary"
                    >
                      <input
                        type="radio"
                        name="stock-status"
                        checked={filters.status === status}
                        onChange={() => setFilters((prev) => ({ ...prev, status }))}
                      />
                      <span>
                        {status === 'ALL' ? 'All' : status.replaceAll('_', ' ').toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
                {locationFilterOptions.length > 0 && (
                  <div className="flex flex-col gap-2 border-b border-card-border pb-4">
                    <div className="text-body-4-emphasis text-text-primary">Location</div>
                    {locationFilterOptions.map((location) => (
                      <label
                        key={location}
                        className="flex items-center gap-3 text-body-4 text-text-primary"
                      >
                        <input
                          type="checkbox"
                          checked={filters.locations.includes(location)}
                          onChange={() => toggleListFilter('locations', location)}
                          className="size-4 accent-blue-text"
                        />
                        <span>{location}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2 border-b border-card-border pb-4">
                  <div className="text-body-4-emphasis text-text-primary">Category</div>
                  {categoryOptions.map((category) => (
                    <div key={category} className="flex flex-col gap-2">
                      <label className="flex items-center gap-3 text-body-4 text-text-primary">
                        <input
                          type="checkbox"
                          checked={filters.categories.includes(category)}
                          onChange={() => toggleCategoryFilter(category)}
                          className="size-4 accent-blue-text"
                        />
                        <span>{category}</span>
                      </label>
                      {filters.categories.includes(category) &&
                        categorySubcategoryOptions[category]?.map((subCategory) => (
                          <label
                            key={`${category}-${subCategory}`}
                            className="ml-7 flex items-center gap-3 text-body-4 text-text-secondary"
                          >
                            <input
                              type="checkbox"
                              checked={filters.subCategories.includes(subCategory)}
                              onChange={() => toggleListFilter('subCategories', subCategory)}
                              className="size-4 accent-blue-text"
                            />
                            <span>{subCategory}</span>
                          </label>
                        ))}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 border-b border-card-border pb-4">
                  <div className="text-body-4-emphasis text-text-primary">ABC class</div>
                  {AbcClassOptions.map((abcClass) => (
                    <label
                      key={abcClass}
                      className="flex items-center gap-3 text-body-4 text-text-primary"
                    >
                      <input
                        type="checkbox"
                        checked={filters.abcClasses.includes(abcClass)}
                        onChange={() => toggleListFilter('abcClasses', abcClass)}
                        className="size-4 accent-blue-text"
                      />
                      <span>{abcClass}</span>
                    </label>
                  ))}
                </div>
                {supplierFilterOptions.length > 0 && (
                  <div className="flex flex-col gap-2 border-b border-card-border pb-4">
                    <div className="text-body-4-emphasis text-text-primary">Supplier</div>
                    {supplierFilterOptions.map((supplier) => (
                      <label
                        key={supplier}
                        className="flex items-center gap-3 text-body-4 text-text-primary"
                      >
                        <input
                          type="checkbox"
                          checked={filters.suppliers.includes(supplier)}
                          onChange={() => toggleListFilter('suppliers', supplier)}
                          className="size-4 accent-blue-text"
                        />
                        <span>{supplier}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="text-body-4-emphasis text-text-primary">Visibility</div>
                  {(['ALL', 'ACTIVE', 'HIDDEN'] as const).map((visibility) => (
                    <label
                      key={visibility}
                      className="flex items-center gap-3 text-body-4 text-text-primary"
                    >
                      <input
                        type="radio"
                        name="inventory-visibility"
                        checked={filters.visibility === visibility}
                        onChange={() => setFilters((prev) => ({ ...prev, visibility }))}
                      />
                      <span>{getVisibilityLabel(visibility)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-card-border pt-5 mt-5">
                <Primary
                  href="#"
                  text="Apply"
                  onClick={() => setFilterOpen(false)}
                  icon={<FiCheck size={18} aria-hidden="true" />}
                />
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-text-primary bg-white px-4 text-body-3-emphasis text-text-primary"
                >
                  Discard
                </button>
              </div>
            </div>
          </Modal>
        )}

        {activeInventory && (
          <InventoryInfo
            showModal={viewInventory}
            setShowModal={setViewInventory}
            activeInventory={activeInventory}
            businessType={activeInventory.businessType ?? resolvedBusinessType}
            onUpdate={handleUpdateInventory}
            onAddBatch={handleAddBatch}
            onUpdateBatch={handleUpdateBatch}
            onHide={handleHideInventory}
            onUnhide={handleUnhideInventory}
            canEdit={canEditInventory}
            stockLocationOptions={stockLocationOptions}
            initialSection={infoInitialSection}
          />
        )}
      </PermissionGate>
    </div>
  );
};

const ProtectedInventory = () => {
  return (
    <ProtectedRoute skeleton={INVENTORY_PAGE_SKELETON}>
      <OrgGuard skeleton={INVENTORY_PAGE_SKELETON}>
        <Suspense fallback={INVENTORY_PAGE_SKELETON}>
          <Inventory />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedInventory;
