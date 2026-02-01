'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, X, ChevronDown, ChevronUp, Plus, Search, LayoutGrid, List, SlidersHorizontal, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input, Button, Select, Sheet, MultiSelectCombobox, useDialog, Label } from '@/components/ui';
import type { MultiSelectOption } from '@/components/ui';
import {
  usePaginatedReceipts,
  useReceiptsGroupedByLBA,
  useLBAUnits,
} from '@/hooks';
import type { ReceiptWithUnit } from '@/types';
import type { PaginatedResponse } from '@/hooks/usePaginatedQuery';
import { useTexts } from '@/hooks/useTexts';

const ITEMS_PER_PAGE = 10;
const PREVIEW_ITEMS_COUNT = 5;

export default function ReceiptsListPage() {
  const router = useRouter();
  const { t } = useTexts();
  const { showAlert } = useDialog();
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    lbaNames: [] as string[],
    crop: '',
  });

  // Derive active tab from filters to prevent state desync
  const activeLbaTab = useMemo(() => {
    if (filters.lbaNames.length === 1) return filters.lbaNames[0];
    return 'all';
  }, [filters.lbaNames]);
  // Track pagination state for each group
  const [groupPages, setGroupPages] = useState<Record<number, number>>({});
  // Track which group's sheet is open (using unit as ID)
  const [openSheetGroupName, setOpenSheetGroupName] = useState<string | null>(null);
  // Track pagination state for sheet view
  const [sheetPage, setSheetPage] = useState<number>(1);

  // Scroll logic for LBA tabs
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 2); // Tiny buffer
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Fetch LBA units for filter dropdown
  const { data: lbaUnits = [] } = useLBAUnits();

  // Fetch grouped receipts (for grouped view)
  const {
    data: groupedReceipts = [],
    isLoading: loadingGrouped,
  } = useReceiptsGroupedByLBA();

  // Fetch paginated receipts (for list view)
  // Note: Backend only supports single lbaUnitId, so we filter client-side for multiple selections
  const paginatedFilters = useMemo(() => {
    const result: {
      dateFrom?: string;
      dateTo?: string;
      lbaUnitId?: number;
      lbaName?: string;
      crop?: string;
    } = {};
    if (filters.dateFrom) result.dateFrom = filters.dateFrom;
    if (filters.dateTo) result.dateTo = filters.dateTo;
    // Only use backend filter if exactly one name is selected
    if (filters.lbaNames.length === 1) {
      result.lbaName = filters.lbaNames[0];
    }
    if (filters.crop) result.crop = filters.crop;
    return result;
  }, [filters]);

  const paginatedReceiptsQuery = usePaginatedReceipts(
    Object.keys(paginatedFilters).length > 0 ? paginatedFilters : undefined,
    20
  );

  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingList,
  } = paginatedReceiptsQuery;

  // Flatten paginated data and apply client-side filtering for multiple LBA units
  const receipts: ReceiptWithUnit[] = useMemo(() => {
    if (!paginatedData) return [];

    // Handle TanStack Query v5 structure: data.pages is an array
    let pages: PaginatedResponse<ReceiptWithUnit>[];
    if (Array.isArray(paginatedData)) {
      // If data is directly an array (older structure)
      pages = paginatedData as PaginatedResponse<ReceiptWithUnit>[];
    } else if ('pages' in paginatedData && Array.isArray(paginatedData.pages)) {
      // If data has pages property (v5 structure)
      pages = paginatedData.pages as PaginatedResponse<ReceiptWithUnit>[];
    } else {
      return [];
    }

    let allReceipts = pages.flatMap((page) => page.data || []);

    // Apply client-side filtering for multiple LBA selections
    if (filters.lbaNames.length > 1) {
      allReceipts = allReceipts.filter((receipt) =>
        receipt.lba_name && filters.lbaNames.includes(receipt.lba_name)
      );
    }

    return allReceipts;
  }, [paginatedData, filters.lbaNames]);

  const loading = viewMode === 'grouped' ? loadingGrouped : loadingList;

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Base groups filtered by criteria other than unit ID (used for tabs and summary)
  const availableGroups = useMemo(() => {
    let filtered = [...groupedReceipts];

    // Ensure all groups have receipts array
    filtered = filtered.map(group => ({
      ...group,
      receipts: Array.isArray(group.receipts) ? group.receipts : []
    }));

    if (filters.crop) {
      filtered = filtered.filter((g) => g.crop?.toLowerCase().includes(filters.crop.toLowerCase()));
    }

    // Apply date filters to receipts within each group
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.map(group => ({
        ...group,
        receipts: group.receipts.filter((r) => {
          if (filters.dateFrom && r.date < filters.dateFrom) return false;
          if (filters.dateTo && r.date > filters.dateTo) return false;
          return true;
        })
      }));
    }

    return filtered.filter(group => group.receipts.length > 0);
  }, [filters.crop, filters.dateFrom, filters.dateTo, groupedReceipts]);

  // Final filtered list including name selections (used for display and total balance)
  const filteredGroupedReceipts = useMemo(() => {
    if (filters.lbaNames.length === 0) return availableGroups;
    return availableGroups.filter((g) => filters.lbaNames.includes(g.unit));
  }, [availableGroups, filters.lbaNames]);

  // Update scroll buttons when data changes or view switches
  useEffect(() => {
    const timer = setTimeout(checkScroll, 100); // Wait for render
    return () => clearTimeout(timer);
  }, [checkScroll, availableGroups, viewMode]);

  // Get paginated receipts for a specific group
  const getPaginatedReceiptsForGroup = useCallback((groupReceipts: ReceiptWithUnit[], groupName: string) => {
    const currentPage = groupPages[groupName as any] || 1;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return groupReceipts.slice(startIndex, endIndex);
  }, [groupPages]);

  // Get preview receipts (first 5) for a group
  const getPreviewReceiptsForGroup = useCallback((groupReceipts: ReceiptWithUnit[]) => {
    return groupReceipts.slice(0, PREVIEW_ITEMS_COUNT);
  }, []);

  // Get accumulated receipts for sheet view (all items from page 1 to current page)
  const getSheetPaginatedReceipts = useCallback((groupReceipts: ReceiptWithUnit[]) => {
    const endIndex = sheetPage * ITEMS_PER_PAGE;
    return groupReceipts.slice(0, endIndex);
  }, [sheetPage]);

  // Get total pages for a group
  const getTotalPagesForGroup = useCallback((groupReceipts: ReceiptWithUnit[]) => {
    return Math.ceil(groupReceipts.length / ITEMS_PER_PAGE);
  }, []);

  // Handle page change for a group
  const handleGroupPageChange = useCallback((groupName: string, page: number) => {
    setGroupPages(prev => ({ ...prev, [groupName]: page }));
  }, []);

  // Handle opening sheet for a group
  const handleOpenSheet = useCallback((groupName: string) => {
    setOpenSheetGroupName(groupName);
    setSheetPage(1);
  }, []);

  // Handle closing sheet
  const handleCloseSheet = useCallback(() => {
    setOpenSheetGroupName(null);
    setSheetPage(1);
  }, []);

  // Reset pagination when filters change (but don't reset active unit tab as it's now derived)
  useEffect(() => {
    setGroupPages({});
    setOpenSheetGroupName(null);
    setSheetPage(1);
  }, [filters]);

  function clearFilters() {
    setFilters({
      dateFrom: '',
      dateTo: '',
      lbaNames: [],
      crop: '',
    });
  }

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.lbaNames.length > 0) count++;
    if (filters.crop) count++;
    return count;
  }, [filters]);

  const totalOutstandingBalance = useMemo(() => {
    return filteredGroupedReceipts.reduce((sum, g) => sum + (g.outstanding_balance || 0), 0);
  }, [filteredGroupedReceipts]);

  // Prepare LBA Name options for multi-select
  const lbaNameOptions: MultiSelectOption[] = useMemo(() => {
    // Get unique LBA Names from available groups
    const names = Array.from(new Set(availableGroups.map(g => g.unit)));
    return names.map((name) => ({
      value: name,
      label: name,
    }));
  }, [availableGroups]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading stock cards...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Sticky Header & Filter Section */}
      <div className={`sticky  top-0 z-30 bg-white/95 backdrop-blur-sm transition-all duration-300 ${isScrolled ? 'py-4 shadow-sm' : 'py-8'}`}>
        {/* Page Header */}
        <div className={`flex px-2 flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${isScrolled ? 'mb-4' : 'mb-8'}`}>
          <div>
            <h1 className={`font-extrabold text-gray-900 tracking-tight transition-all duration-300 ${isScrolled ? 'text-xl' : 'text-3xl'}`}>
              {t('receiptList.title', 'Stock Cards')}
            </h1>
            {!isScrolled && (
              <p className="mt-1 text-sm text-gray-500">
                {t('receiptList.subtitle', 'Manage and track inventory across all LBAs.')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 p-1 rounded-lg">
              <Button
                onClick={() => setViewMode('grouped')}
                variant={viewMode === 'grouped' ? 'primary' : 'ghost'}
                size="sm"
                className="px-3"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                {t('receiptList.grouped', 'Grouped')}
              </Button>
              <Button
                onClick={() => setViewMode('list')}
                variant={viewMode === 'list' ? 'primary' : 'ghost'}
                size="sm"
                className="px-3"
              >
                <List className="w-4 h-4 mr-2" />
                {t('receiptList.list', 'List')}
              </Button>
            </div>
            <Button
              onClick={() => setIsFilterSheetOpen(true)}
              variant="outline"
              size={isScrolled ? 'sm' : 'md'}
              className="relative shadow-sm"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              {t('receiptList.filter', 'Filter')}
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button
              onClick={() => router.push('/receipts/create')}
              variant="primary"
              size={isScrolled ? 'sm' : 'md'}
              className="shadow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('receiptList.newEntry', 'New Entry')}
            </Button>
          </div>
        </div>

        {/* Summary Cards & Filter Row */}
        {viewMode === 'grouped' && (
          <div className={`relative px-2 group/scroll transition-all duration-300 ${isScrolled ? 'mb-0' : 'mb-0'}`}>
            <style jsx global>{`
              .no-scrollbar::-webkit-scrollbar {
                display: none;
              }
              .no-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>

            {canScrollLeft && (
              <button
                onClick={() => scroll('left')}
                className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full p-2 shadow-xl hover:bg-white transition-all ring-1 ring-black/5 ${isScrolled ? '-ml-2' : '-ml-3'}`}
                aria-label="Scroll Left"
              >
                <ChevronLeft className="w-5 h-5 text-blue-600" />
              </button>
            )}

            {canScrollRight && (
              <button
                onClick={() => scroll('right')}
                className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full p-2 shadow-xl hover:bg-white transition-all ring-1 ring-black/5 ${isScrolled ? '-mr-2' : '-mr-3'}`}
                aria-label="Scroll Right"
              >
                <ChevronRight className="w-5 h-5 text-blue-600" />
              </button>
            )}

            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className={`flex px-4 items-start gap-4 overflow-x-auto no-scrollbar scroll-smooth transition-all duration-300 ${isScrolled ? 'pb-1' : 'pb-2'}`}
            >
              {/* Filter Trigger Card */}
              <button
                onClick={() => setIsFilterSheetOpen(true)}
                className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300 ${isScrolled ? 'w-24 h-20' : 'w-32 h-[104px]'} ${activeFilterCount > 0
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:bg-gray-100'
                  }`}
              >
                <div className="relative">
                  <SlidersHorizontal className={`${isScrolled ? 'w-4 h-4 mb-1' : 'w-6 h-6 mb-2'}`} />
                  {activeFilterCount > 0 && (
                    <span className={`absolute -top-1 -right-1 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center border-2 border-white ${isScrolled ? 'text-[8px] w-3 h-3' : 'text-[10px] w-4 h-4'}`}>
                      {activeFilterCount}
                    </span>
                  )}
                </div>
                <span className={`font-semibold uppercase tracking-wider ${isScrolled ? 'text-[10px]' : 'text-xs'}`}>Filters</span>
              </button>

              {/* All Units Tab */}
              <button
                onClick={() => {
                  setFilters(prev => ({ ...prev, lbaNames: [] }));
                }}
                className={`flex-shrink-0 rounded-xl border-2 transition-all duration-300 text-left ${isScrolled ? 'w-44 p-3' : 'w-56 p-4'} ${activeLbaTab === 'all'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                  : 'bg-white border-gray-100 text-gray-900 hover:border-gray-200'
                  }`}
              >
                <div className={`font-medium uppercase tracking-wider flex justify-between ${isScrolled ? 'text-[9px] mb-0.5' : 'text-xs mb-1'} ${activeLbaTab === 'all' ? 'text-blue-100' : 'text-gray-400'}`}>
                  <span>{t('receiptList.overview', 'Overview')}</span>
                  {!isScrolled && <span>{availableGroups.length} LBAs</span>}
                </div>
                <div className={`font-bold transition-all duration-300 ${isScrolled ? 'text-sm' : 'text-lg'}`}>{t('receiptList.allLBAs', 'All LBAs')}</div>
                <div className={`font-semibold transition-all duration-300 ${isScrolled ? 'text-xs mt-0.5' : 'text-base mt-1'} ${activeLbaTab === 'all' ? 'text-blue-50' : 'text-blue-600'}`}>
                  {formatCurrency(totalOutstandingBalance)}
                </div>
              </button>

              {/* LBA Unit Tabs */}
              {
                availableGroups.map((group) => {
                  return (
                    <button
                      key={group.unit}
                      onClick={() => {
                        setFilters(prev => ({ ...prev, lbaNames: [group.unit] }));
                      }}
                      className={`flex-shrink-0 rounded-xl border-2 transition-all duration-300 text-left ${isScrolled ? 'w-44 p-3' : 'w-56 p-4'} ${activeLbaTab === group.unit
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100'
                        : 'bg-white border-gray-100 text-gray-900 hover:border-gray-200'
                        }`}
                    >
                      <div className={`font-bold truncate transition-all duration-300 ${isScrolled ? 'text-sm' : 'text-lg'}`}>
                        {group.lba_name}
                      </div>
                      <div className={`font-medium uppercase tracking-wider flex justify-start transition-all duration-300 ${isScrolled ? 'text-[9px] mb-0.5' : 'text-xs mb-1'} ${activeLbaTab === group.unit ? 'text-blue-100' : 'text-gray-400'}`}>
                        <span>{group.receipts.length} {group.receipts.length === 1 ? 'entry' : 'entries'}</span>
                      </div>
                      <div className={`font-semibold transition-all duration-300 ${isScrolled ? 'text-xs mt-0.5' : 'text-base mt-1'} ${activeLbaTab === group.unit ? 'text-white' : 'text-blue-600'}`}>
                        {formatCurrency(group.outstanding_balance)}
                      </div>
                    </button>
                  )
                })
              }
            </div>
          </div>
        )}
      </div>

      <div className="pt-8">

        {/* Filter Sheet */}
        <Sheet
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          title={t('receiptList.filterTitle', 'Filter Stock Cards')}
          maxWidth="md"
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-semibold text-gray-900 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Date Range
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="sheet-date-from" className="text-xs text-gray-500 font-medium">From</label>
                    <Input
                      id="sheet-date-from"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="sheet-date-to" className="text-xs text-gray-500 font-medium">To</label>
                    <Input
                      id="sheet-date-to"
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold text-gray-900">LBAs</Label>
                <MultiSelectCombobox
                  options={lbaNameOptions}
                  selectedValues={filters.lbaNames}
                  onChange={(values) => setFilters({ ...filters, lbaNames: values })}
                  placeholder="Select one or more LBAs..."
                />
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold text-gray-900">Search Crop</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    value={filters.crop}
                    onChange={(e) => setFilters({ ...filters, crop: e.target.value })}
                    placeholder="e.g. Cocoa, Coffee..."
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="pt-8 mt-8 border-t border-gray-100 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="flex-1"
                disabled={activeFilterCount === 0}
              >
                {t('receiptList.clearFilters', 'Reset All')}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1"
              >
                Show Results
              </Button>
            </div>
          </div>
        </Sheet>

        {/* Active Filter Chips (Inline Indicator) */}
        {
          activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Active Filters:</span>
              {filters.dateFrom && (
                <div className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                  From: {filters.dateFrom}
                  <button onClick={() => setFilters({ ...filters, dateFrom: '' })} className="ml-2 hover:text-blue-900"><X className="w-3 h-3" /></button>
                </div>
              )}
              {filters.dateTo && (
                <div className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                  To: {filters.dateTo}
                  <button onClick={() => setFilters({ ...filters, dateTo: '' })} className="ml-2 hover:text-blue-900"><X className="w-3 h-3" /></button>
                </div>
              )}
              {filters.lbaNames.length > 0 && (
                <div className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                  {filters.lbaNames.length} LBAs
                  <button onClick={() => setFilters({ ...filters, lbaNames: [] })} className="ml-2 hover:text-blue-900"><X className="w-3 h-3" /></button>
                </div>
              )}
              {filters.crop && (
                <div className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                  Crop: {filters.crop}
                  <button onClick={() => setFilters({ ...filters, crop: '' })} className="ml-2 hover:text-blue-900"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          )
        }

        {/* Receipts Display */}
        {
          viewMode === 'grouped' ? (
            <div className="space-y-6">
              {filteredGroupedReceipts.length === 0 ? (
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-12 text-center">
                  <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('receiptList.noStockCards', 'No stock cards found')}</h3>
                  <p className="text-gray-500 mt-1 max-w-xs mx-auto">
                    {groupedReceipts.length === 0 ? t('receiptList.noStockCardsDesc', 'Create your first stock card to see it here.') : t('receiptList.noStockCardsFilterDesc', 'Try adjusting your filters to find what you\'re looking for.')}
                  </p>
                  {activeFilterCount > 0 && (
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      size="sm"
                      className="mt-6"
                    >
                      {t('receiptList.clearFilters', 'Clear all filters')}
                    </Button>
                  )}
                </div>
              ) : (
                filteredGroupedReceipts
                  .filter(group => activeLbaTab === 'all' || group.unit === activeLbaTab)
                  .map((group) => {
                    const groupName = group.unit;
                    // Ensure receipts is an array
                    const groupReceipts = Array.isArray(group.receipts) ? group.receipts : [];
                    // Show "View All" only if there are more than 5 items
                    // Always display at least 5 rows if available
                    const hasMoreThanFive = groupReceipts.length > PREVIEW_ITEMS_COUNT;
                    const displayReceipts = hasMoreThanFive
                      ? getPreviewReceiptsForGroup(groupReceipts) // Show exactly 5
                      : groupReceipts; // Show all if 5 or fewer

                    return (
                      <div key={groupName} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden ring-1 ring-black ring-opacity-5">
                        {/* Group Header */}
                        <div className="bg-gray-50 px-6 py-5 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">
                                  {group.unit}
                                </h3>
                              </div>
                              {/* {group.crop && group.season && (
                              <p className="text-sm text-gray-500 mt-0.5">
                                {group.crop} • {group.season}
                              </p>
                            )} */}
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Balance</p>
                              <div className={`text-2xl font-black tracking-tight ${group.outstanding_balance >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {formatCurrency(group.outstanding_balance)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="relative">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              {/* Table Header */}
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Date
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    WHR Number
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('lbaUnit.lbaName')}
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {t('lbaUnit.lbaCode')}
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Crop
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Season
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Unit Head
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    QCI Name
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Description
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Previous Balance
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Credit
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Debit
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Balance
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Bags
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    MTS
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Signature
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {displayReceipts.length === 0 ? (
                                  <tr>
                                    <td colSpan={16} className="px-6 py-4 text-center text-sm text-gray-500">
                                      No receipts found
                                    </td>
                                  </tr>
                                ) : (
                                  displayReceipts.map((receipt, index) => (
                                    <tr
                                      key={receipt.id || `receipt-${groupName}-${index}`}
                                      className="hover:bg-gray-50 cursor-pointer"
                                      onClick={() => receipt.id && router.push(`/receipts/view?id=${receipt.id}`)}
                                    >
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {receipt.date}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {receipt.whr_number}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.lba_name}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.lba_code}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.crop}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.season}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.unit_head}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.qci_name}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                        {receipt.description}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatCurrency(receipt.previous_balance || 0)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatCurrency(receipt.credit_amount)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatCurrency(receipt.debit_amount)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {formatCurrency(receipt.balance_ghc)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.bags}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.mts}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {receipt.item_signatures || receipt.signature}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                          {/* View All Button */}
                          {hasMoreThanFive && (
                            <div className="px-6 py-4 border-t border-gray-200 text-center">
                              <Button
                                onClick={() => handleOpenSheet(groupName)}
                                variant="primary"
                                size="sm"
                              >
                                {t('receiptList.viewAll', 'View All')} ({groupReceipts.length} stock cards)
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {receipts.length === 0 && !loadingList ? (
                <div className="px-4 py-5 sm:px-6 text-center text-gray-500">
                  No stock cards found. Create your first stock card to get started.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            WHR Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('lbaUnit.lbaName')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('lbaUnit.lbaCode')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Crop
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Season
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Unit Head
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            QCI Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Previous Balance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Credit
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Debit
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bags
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            MTS
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Signature
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {receipts.map((receipt) => (
                          <tr
                            key={receipt.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => receipt.id && router.push(`/receipts/view?id=${receipt.id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {receipt.date}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {receipt.whr_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.lba_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.lba_code}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.crop}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.season}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.unit_head}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.qci_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                              {receipt.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(receipt.previous_balance || 0)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(receipt.credit_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(receipt.debit_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCurrency(receipt.balance_ghc)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.bags}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.mts}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {receipt.item_signatures || receipt.signature}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasNextPage && (
                    <div className="px-4 py-4 border-t border-gray-200 text-center">
                      <Button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        variant="primary"
                      >
                        {isFetchingNextPage ? t('common.loading', 'Loading...') : t('receiptList.loadMore', 'Load More')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        }

        <div className="mt-8 text-sm text-gray-400 flex items-center justify-center border-t border-gray-100 pt-8">
          {viewMode === 'grouped' ? (
            <p>
              Showing <span className="font-semibold text-gray-600">{filteredGroupedReceipts.length}</span> LBAs with{' '}
              <span className="font-semibold text-gray-600">
                {filteredGroupedReceipts.reduce((sum, g) => sum + g.receipts.length, 0)}
              </span>{' '}
              total {filteredGroupedReceipts.reduce((sum, g) => sum + g.receipts.length, 0) === 1 ? 'entry' : 'entries'}
            </p>
          ) : (
            <p>
              Showing <span className="font-semibold text-gray-600">{receipts.length}</span> stock card{' '}
              {receipts.length === 1 ? 'entry' : 'entries'}
              {(() => {
                if (!paginatedData) return null;
                let pages: PaginatedResponse<ReceiptWithUnit>[];
                if (Array.isArray(paginatedData)) {
                  pages = paginatedData;
                } else if ('pages' in paginatedData && Array.isArray(paginatedData.pages)) {
                  pages = paginatedData.pages as PaginatedResponse<ReceiptWithUnit>[];
                } else {
                  return null;
                }
                return pages[0]?.total ? <> of {pages[0].total}</> : null;
              })()}
            </p>
          )}
        </div>
      </div>

      {/* Sheet for View All */}
      {
        openSheetGroupName !== null && (() => {
          const group = filteredGroupedReceipts.find(g => g.unit === openSheetGroupName);
          if (!group) return null;

          const sheetReceipts = getSheetPaginatedReceipts(group.receipts);
          const totalPages = getTotalPagesForGroup(group.receipts);

          return (
            <Sheet
              isOpen={true}
              onClose={handleCloseSheet}
              title={`${group.unit} ${group.receipts.length === 1 ? 'entry' : 'entries'}`}
              maxWidth="full"
            >
              <div className="space-y-6">
                {/* Summary Card in Sheet */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      {group.crop && group.season && (
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
                          {group.crop} • {group.season}
                        </p>
                      )}
                      <h3 className="text-xl font-bold text-gray-900">{group.unit}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Total of {group.receipts.length} {group.receipts.length === 1 ? 'entry' : 'entries'} found
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Net Balance</p>
                      <div className={`text-3xl font-black tracking-tight ${group.outstanding_balance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {formatCurrency(group.outstanding_balance)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">WHR No.</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{t('lbaUnit.lbaName')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{t('lbaUnit.lbaCode')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Crop</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Season</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Unit Head</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">QCI Name</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Description</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Previous Balance</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Credit</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Debit</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Balance</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Bags</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">MTS</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Signature</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sheetReceipts.map((receipt) => (
                        <tr
                          key={receipt.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => {
                            if (receipt.id) {
                              handleCloseSheet();
                              router.push(`/receipts/view?id=${receipt.id}`);
                            }
                          }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{receipt.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{receipt.whr_number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{receipt.lba_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.lba_code}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.crop}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.season}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.unit_head}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.qci_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{receipt.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatCurrency(receipt.previous_balance || 0)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatCurrency(receipt.credit_amount)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatCurrency(receipt.debit_amount)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">{formatCurrency(receipt.balance_ghc)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{receipt.bags}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{receipt.mts}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.item_signatures || receipt.signature}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Load More */}
                {sheetPage < totalPages && (
                  <div className="pt-4 flex flex-col items-center">
                    <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-widest">
                      Showing {sheetReceipts.length} of {group.receipts.length}
                    </p>
                    <Button
                      onClick={() => setSheetPage(sheetPage + 1)}
                      variant="outline"
                      size="sm"
                      className="px-8"
                    >
                      Load More Entries
                    </Button>
                  </div>
                )}
              </div>
            </Sheet>
          );
        })()
      }
    </div >
  );
}
