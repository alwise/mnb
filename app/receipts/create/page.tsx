'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AutocompleteInput from '@/components/AutocompleteInput';
import { Input, Textarea, Button, Label, ImagePicker, useDialog } from '@/components/ui';
import {
  createReceipt,
  getPreviousBalance,
  searchLBAUnits,
  getReceiptTotals,
} from '@/lib/receipts';
import { createLBAUnit } from '@/lib/receipts';
import { saveReceiptPhoto } from '@/lib/settings';
import { getUserSignatureDataUrl } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useTexts } from '@/hooks/useTexts';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';
import type { LBAUnit, ReceiptItem } from '@/types';

export default function CreateStockCardPage() {
  const router = useRouter();
  const { showAlert } = useDialog();
  const { user } = useAuth();
  const { t } = useTexts();
  const queryClient = useQueryClient();
  // const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // const [showUnitForm, setShowUnitForm] = useState(false);
  const [lbaUnitDisplay, setLbaUnitDisplay] = useState('');
  const [selectedLBAUnit, setSelectedLBAUnit] = useState<LBAUnit | null>(null);

  const [formData, setFormData] = useState({
    lba_unit_id: '',
    date: new Date().toISOString().split('T')[0],
    whr_number: '',
    description: '',
    credit_amount: '0',
    debit_amount: '0',
    weight: '0',
    balance_ghc: '0',
    previous_balance: '0',
    mts: '0',
    bags: '0',
  });

  const [items, setItems] = useState<Array<{
    serial_number: string;
    date: string;
    whr_number: string;
    description: string;
    credit_amount: string;
    debit_amount: string;
    mts: string;
    bags: string;
    balance_ghc: string;
    balance_lba: string;
    signature: string;
  }>>([{
    serial_number: '1',
    date: new Date().toISOString().split('T')[0],
    whr_number: '',
    description: '',
    credit_amount: '0',
    debit_amount: '0',
    mts: '0',
    bags: '0',
    balance_ghc: '0',
    balance_lba: '0',
    signature: '',
  }]);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cumulativeTotals, setCumulativeTotals] = useState({
    cumulative_credit: 0,
    cumulative_debit: 0,
    cumulative_mts: 0,
    cumulative_bags: 0,
  });

  const [unitFields, setUnitFields] = useState({
    unit: '',
    lba_name: '',
    crop: '',
    season: '',
    unit_head: '',
    qci_name: '',
    lba_code: '',
  });

  const [unitFormData, setUnitFormData] = useState({
    unit: '',
    lba_name: '',
    crop: '',
    season: '',
    unit_head: '',
    qci_name: '',
    lba_code: '',
  });

  const loadPreviousBalance = useCallback(async () => {
    if (!formData.lba_unit_id || !formData.date) return;
    try {
      // Add a small delay to avoid concurrent database access
      await new Promise(resolve => setTimeout(resolve, 100));

      const prevBalance = await getPreviousBalance(parseInt(formData.lba_unit_id), formData.date);
      setFormData(prev => ({ ...prev, previous_balance: prevBalance.toFixed(2) }));

      // Load cumulative totals with delay
      await new Promise(resolve => setTimeout(resolve, 100));
      const totals = await getReceiptTotals(parseInt(formData.lba_unit_id));
      if (totals) {
        setCumulativeTotals({
          cumulative_credit: totals.cumulative_credit || 0,
          cumulative_debit: totals.cumulative_debit || 0,
          cumulative_mts: totals.cumulative_mts || 0,
          cumulative_bags: totals.cumulative_bags || 0,
        });
      }
    } catch (error) {
      console.error('Error loading previous balance:', error);
    }
  }, [formData.lba_unit_id, formData.date]);

  useEffect(() => {
    if (formData.lba_unit_id && formData.date) {
      loadPreviousBalance();
    }
  }, [formData.lba_unit_id, formData.date, loadPreviousBalance]);

  function handlePhotoChange(file: File | null) {
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPhoto(null);
      setPhotoPreview(null);
    }
  }

  function handleLBAUnitSelect(unit: LBAUnit) {
    setSelectedLBAUnit(unit);
    setLbaUnitDisplay(getLBAUnitDisplay(unit));
    if (unit.id) {
      setFormData(prev => ({ ...prev, lba_unit_id: unit.id!.toString() }));
    }
    // Auto-fill all fields when unit is selected
    setUnitFields({
      unit: unit.unit || '',
      lba_name: unit.lba_name || '',
      crop: unit.crop || '',
      season: unit.season || '',
      unit_head: unit.unit_head || '',
      qci_name: unit.qci_name || '',
      lba_code: unit.lba_code || '',
    });
  }

  function getLBAUnitDisplay(unit: LBAUnit): string {
    return `${unit.lba_name}`;
  }

  useEffect(() => {
    const previous = parseFloat(formData.previous_balance) || 0;
    const credit = parseFloat(formData.credit_amount) || 0;
    const debit = parseFloat(formData.debit_amount) || 0;
    const balance = previous + credit - debit;
    setFormData((prev) => ({ ...prev, balance_ghc: balance.toFixed(2) }));
  }, [formData.credit_amount, formData.debit_amount, formData.previous_balance]);

  function addItem() {
    setItems([...items, {
      serial_number: (items.length + 1).toString(),
      date: formData.date,
      whr_number: formData.whr_number,
      description: '',
      credit_amount: '0',
      debit_amount: '0',
      mts: '0',
      bags: '0',
      balance_ghc: '0',
      balance_lba: '0',
      signature: '',
    }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      // Renumber serial numbers
      newItems.forEach((item, idx) => {
        item.serial_number = (idx + 1).toString();
      });
      setItems(newItems);

      // Recalculate totals
      const totalCredit = newItems.reduce((sum, item) => sum + (parseFloat(item.credit_amount) || 0), 0);
      const totalDebit = newItems.reduce((sum, item) => sum + (parseFloat(item.debit_amount) || 0), 0);
      const totalMts = newItems.reduce((sum, item) => sum + (parseFloat(item.mts) || 0), 0);
      const totalBags = newItems.reduce((sum, item) => sum + (parseInt(item.bags) || 0), 0);

      setFormData(prev => ({
        ...prev,
        credit_amount: totalCredit.toFixed(2),
        debit_amount: totalDebit.toFixed(2),
        mts: totalMts.toFixed(2),
        bags: totalBags.toString(),
      }));
    }
  }

  function updateItem(index: number, field: string, value: string) {
    const newItems = items.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    });

    // Only auto-update serial numbers if serial_number field wasn't changed
    // This allows users to manually set serial numbers
    let updatedItems;
    if (field !== 'serial_number') {
      // Auto-update serial numbers for items that don't have custom ones
      updatedItems = newItems.map((item, idx) => ({
        ...item,
        serial_number: item.serial_number || (idx + 1).toString(),
      }));
    } else {
      // If serial_number was changed manually, keep the manual value
      updatedItems = newItems;
    }

    // Recalculate totals from items
    const totalCredit = updatedItems.reduce((sum, item) => sum + (parseFloat(item.credit_amount) || 0), 0);
    const totalDebit = updatedItems.reduce((sum, item) => sum + (parseFloat(item.debit_amount) || 0), 0);
    const totalMts = updatedItems.reduce((sum, item) => sum + (parseFloat(item.mts) || 0), 0);
    const totalBags = updatedItems.reduce((sum, item) => sum + (parseInt(item.bags) || 0), 0);

    // Calculate balance for each item
    let runningBalance = parseFloat(formData.previous_balance) || 0;
    const itemsWithBalance = updatedItems.map((item) => {
      const credit = parseFloat(item.credit_amount) || 0;
      const debit = parseFloat(item.debit_amount) || 0;
      runningBalance = runningBalance + credit - debit;
      return { ...item, signature: item.signature ?? '', balance_ghc: runningBalance.toFixed(2) };
    });

    setItems(itemsWithBalance);

    setFormData(prev => ({
      ...prev,
      credit_amount: totalCredit.toFixed(2),
      debit_amount: totalDebit.toFixed(2),
      mts: totalMts.toFixed(2),
      bags: totalBags.toString(),
    }));
  }

  // async function handleCreateUnit(e: React.FormEvent) {
  //   e.preventDefault();
  //   try {
  //     setSubmitting(true);
  //     const unitId = await createLBAUnit(unitFormData);
  //     const newUnit: LBAUnit = {
  //       ...unitFormData,
  //       id: unitId,
  //     };
  //     setSelectedLBAUnit(newUnit);
  //     setLbaUnitDisplay(getLBAUnitDisplay(newUnit));
  //     setFormData((prev) => ({ ...prev, lba_unit_id: unitId.toString() }));
  //     // setShowUnitForm(false);
  //     setUnitFormData({
  //       unit: '',
  //       lba_name: '',
  //       crop: '',
  //       season: '',
  //       unit_head: '',
  //       qci_name: '',
  //       lba_code: '',
  //     });
  //     await showAlert(t('lbaUnit.createSuccess'));
  //   } catch (error) {
  //     console.error('Error creating LBA unit:', error);
  //     await showAlert(t('lbaUnit.createError'));
  //   } finally {
  //     setSubmitting(false);
  //   }
  // }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Check if user has entered a name for LBA
    if (!lbaUnitDisplay.trim() && !unitFields.unit.trim()) {
      await showAlert(`Please enter an ${t('lbaUnit.lbaName')} or fill in the unit information.`);
      return;
    }

    try {
      setSubmitting(true);

      // Small delay to ensure any pending database operations complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get or create LBA unit ID
      let lbaUnitId: number;

      if (selectedLBAUnit?.id) {
        // Use selected unit's ID
        lbaUnitId = selectedLBAUnit.id;
      } else if (formData.lba_unit_id) {
        // Use existing formData ID
        lbaUnitId = parseInt(formData.lba_unit_id);
      } else {
        // Create a new LBA unit with the typed/filled information
        const newUnitData = {
          unit: unitFields.unit || lbaUnitDisplay.split('(')[0].trim() || 'New Unit',
          lba_name: unitFields.lba_name || lbaUnitDisplay.split('(')[0].trim() || 'New Unit',
          crop: unitFields.crop || '',
          season: unitFields.season || '',
          unit_head: unitFields.unit_head || '',
          qci_name: unitFields.qci_name || '',
          lba_code: unitFields.lba_code || '',
        };
        lbaUnitId = await createLBAUnit(newUnitData);
        // Update formData with the new unit ID
        setFormData(prev => ({ ...prev, lba_unit_id: lbaUnitId.toString() }));

        // Wait a bit to ensure the transaction from createLBAUnit is fully committed
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Use user signature - check if user has signature uploaded
      // let signature = 'User Signature';
      // if (user) {
      //   try {
      //     const userSignature = await getUserSignatureDataUrl(user.id);
      //     if (userSignature) {
      //       signature = 'User Signature';
      //     }
      //   } catch (error) {
      //     console.log('No user signature found, using default');
      //   }
      // }

      // Use the first item's date and whr_number if available, otherwise use form data
      const firstItem = items[0];
      const receiptDate = firstItem?.date || formData.date;
      const receiptWHR = firstItem?.whr_number || formData.whr_number;

      // Validate required fields
      if (!receiptDate) {
        await showAlert('Please enter a date for at least one item in the table.');
        setSubmitting(false);
        return;
      }

      if (!receiptWHR) {
        await showAlert('Please enter a WHR Number for at least one item in the table.');
        setSubmitting(false);
        return;
      }

      const receiptData = {
        lba_unit_id: lbaUnitId,
        lba_name: unitFields.lba_name || lbaUnitDisplay.split('(')[0].trim() || 'New Unit',
        date: receiptDate,
        whr_number: receiptWHR,
        description: firstItem?.description || formData.description || 'Stock Card Entry',
        credit_amount: parseFloat(formData.credit_amount) || 0,
        debit_amount: parseFloat(formData.debit_amount) || 0,
        weight: 0, // Not used in stockcard format
        balance_ghc: parseFloat(formData.balance_ghc) || 0,
        previous_balance: parseFloat(formData.previous_balance) || 0,
        mts: parseFloat(formData.mts) || 0,
        bags: parseInt(formData.bags) || 0,
        signature: "",
      };

      // Convert items to ReceiptItem format
      // Filter out items with empty descriptions and ensure we have at least one valid item
      const validItems = items.filter(item => item.description.trim() !== '');

      if (validItems.length === 0) {
        await showAlert('Please enter at least one item with a description in the table.');
        setSubmitting(false);
        return;
      }

      const receiptItems: Omit<ReceiptItem, 'id' | 'receipt_id' | 'created_at'>[] = validItems
        .map((item, index) => ({
          description: `${item.serial_number || (index + 1)}. ${item.description} (WHR: ${item.whr_number || 'N/A'}, Date: ${item.date || 'N/A'})`,
          credit_amount: parseFloat(item.credit_amount) || 0,
          debit_amount: parseFloat(item.debit_amount) || 0,
          weight: 0, // Weight not used in stockcard format
          mts: parseFloat(item.mts) || 0,
          bags: parseInt(item.bags) || 0,
          item_order: index,
          signature: item.signature || '',
        }));

      // console.log('Creating receipt with data:', receiptData);
      // console.log('Receipt items:', receiptItems);

      const receiptId = await createReceipt(receiptData, receiptItems.length > 0 ? receiptItems : undefined);

      // Save photo if provided
      if (photo) {
        try {
          await saveReceiptPhoto(receiptId, photo);
        } catch (error) {
          console.error('Error saving receipt photo:', error);
          // Don't fail the whole operation if photo save fails
        }
      }

      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts.list(user.id) });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts.paginated(user.id) });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts.stats(user.id) });
        await queryClient.invalidateQueries({ queryKey: ['receipts', user.id, 'totals'] });
      }

      await showAlert(t('receipts.createSuccess'));
      router.push('/receipts');
    } catch (error) {
      console.error('Error creating stock card:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(`${t('receipts.createError')}: ${errorMessage}\n\nPlease check the browser console for more details.`);
    } finally {
      setSubmitting(false);
    }
  }


  // const cumulativeCredit = cumulativeTotals.cumulative_credit + (parseFloat(formData.credit_amount) || 0);
  // const cumulativeDebit = cumulativeTotals.cumulative_debit + (parseFloat(formData.debit_amount) || 0);
  // const cumulativeMts = cumulativeTotals.cumulative_mts + (parseFloat(formData.mts) || 0);
  // const cumulativeBags = cumulativeTotals.cumulative_bags + (parseInt(formData.bags) || 0);

  return (
    <div className="max-w-[98%] mx-auto py-6" style={{ overflowY: 'visible' }}>
      <div className="py-6" style={{ overflowY: 'visible' }}>
        {/* Header */}
        {/* <div className="mb-6 text-center border-b-2 border-blue-600 pb-4">
          <h1 className="text-sm font-semibold text-blue-600 mb-2">EDIBLE NUTS – CASHEW</h1>
          <h2 className="text-3xl font-bold text-blue-600 underline">LBA STOCK CARD</h2>
        </div> */}


        {/* {showUnitForm && (
          <div className="mb-6 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('lbaUnit.createUnit')}</h3>
            <form onSubmit={handleCreateUnit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="text"
                  label={t('lbaUnit.unitName')}
                  required
                  value={unitFormData.unit}
                  onChange={(e) => setUnitFormData({ ...unitFormData, unit: e.target.value })}
                />
                <Input
                  type="text"
                  label={t('lbaUnit.lbaCode')}
                  required
                  value={unitFormData.lba_code}
                  onChange={(e) => setUnitFormData({ ...unitFormData, lba_code: e.target.value })}
                />
                <Input
                  type="text"
                  label={t('lbaUnit.crop')}
                  required
                  value={unitFormData.crop}
                  onChange={(e) => setUnitFormData({ ...unitFormData, crop: e.target.value })}
                />
                <Input
                  type="text"
                  label={t('lbaUnit.season')}
                  required
                  value={unitFormData.season}
                  onChange={(e) => setUnitFormData({ ...unitFormData, season: e.target.value })}
                />
                <Input
                  type="text"
                  label={t('lbaUnit.unitHead')}
                  required
                  value={unitFormData.unit_head}
                  onChange={(e) => setUnitFormData({ ...unitFormData, unit_head: e.target.value })}
                />
                <Input
                  type="text"
                  label={t('lbaUnit.qciName')}
                  required
                  value={unitFormData.qci_name}
                  onChange={(e) => setUnitFormData({ ...unitFormData, qci_name: e.target.value })}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={submitting}
                disabled={submitting}
              >
                {t('common.save')}
              </Button>
            </form>
          </div>
        )} */}

        <form onSubmit={handleSubmit}
          autoCorrect='off'
          autoCapitalize='off'
          autoComplete='off'
          spellCheck={true}
          className="bg-white shadow rounded-lg p-2 sm:p-4" style={{ maxHeight: 'none', overflowY: 'visible' }}>
          <div className="space-y-6" style={{ maxHeight: 'none', overflowY: 'visible' }}>
            {/* Top Section: Photo and Unit Info */}
            <div className="grid grid-cols-3 gap-6 border-b-2 border-blue-600 pb-6">
              {/* Photo Area */}
              <div className="col-span-1">
                <ImagePicker
                  label={<span className="text-xl font-bold text-blue-600">{t('common.photo')}</span>}
                  value={photoPreview}
                  onChange={handlePhotoChange}
                  size="custom"
                  aspectRatio="wide"
                  previewClassName="h-48"
                  pickerClassName="border-blue-600 hover:border-blue-700"
                  accept="image/*"
                  enableCamera={true}
                  defaultFacingMode="environment"
                />
              </div>

              {/* Unit Information Fields */}
              <div className="col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('lbaUnit.lbaName')}:</label>
                    <AutocompleteInput<LBAUnit>
                      value={lbaUnitDisplay}
                      onChange={(value) => {
                        setLbaUnitDisplay(value);
                        if (!value) {
                          setSelectedLBAUnit(null);
                          setFormData(prev => ({ ...prev, lba_unit_id: '' }));
                          setUnitFields({
                            unit: '',
                            lba_name: '',
                            crop: '',
                            season: '',
                            unit_head: '',
                            qci_name: '',
                            lba_code: '',
                          });
                        } else if (!selectedLBAUnit) {
                          // If user is typing but hasn't selected, update unit field
                          setUnitFields(prev => ({ ...prev, lba_name: value }));
                        }
                      }}
                      onSelect={handleLBAUnitSelect}
                      fetchSuggestions={searchLBAUnits}
                      getDisplayValue={getLBAUnitDisplay}
                      placeholder={t('lbaUnit.placeholder')}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Input
                      type="text"
                      label={t('lbaUnit.crop').toUpperCase() + ':'}
                      value={unitFields.crop}
                      onChange={(e) => setUnitFields(prev => ({ ...prev, crop: e.target.value }))}
                    />
                  </div>

                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Input
                      type="text"
                      label={t('lbaUnit.season').toUpperCase() + ':'}
                      value={unitFields.season}
                      onChange={(e) => setUnitFields(prev => ({ ...prev, season: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Input
                      type="text"
                      label={t('lbaUnit.unit').toUpperCase() + ':'}
                      value={unitFields.unit}
                      onChange={(e) => setUnitFields(prev => ({ ...prev, unit: e.target.value }))}
                    />
                    <input type="hidden" value={formData.lba_unit_id} />
                  </div>

                  <div>
                    <Input
                      type="text"
                      label={t('lbaUnit.unitHead').toUpperCase() + ':'}
                      value={unitFields.unit_head}
                      onChange={(e) => setUnitFields(prev => ({ ...prev, unit_head: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      type="text"
                      label={t('lbaUnit.qciName').toUpperCase() + ':'}
                      value={unitFields.qci_name}
                      onChange={(e) => setUnitFields(prev => ({ ...prev, qci_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Input
                      type="text"
                      label={t('lbaUnit.lbaCode').toUpperCase() + ':'}
                      value={unitFields.lba_code}
                      onChange={(e) => setUnitFields(prev => ({ ...prev, lba_code: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Card Table */}
            <div className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">{t('activityLog.title')}</h3>
              </div>
              <div className="w-full mb-6" style={{ overflowX: 'auto', overflowY: 'clip', maxHeight: 'none', height: 'auto', paddingBottom: '12px' }}>
                <table className="w-full border-2 border-blue-600 table-fixed" style={{ height: 'auto', display: 'table', marginBottom: '0', minWidth: '1000px' }}>
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[3%]">{t('activityLog.sn')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[7%]">{t('activityLog.date')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[6%]">{t('activityLog.whrNo')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[20%]">{t('activityLog.description')}</th>
                      <th colSpan={2} className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[14%]">{t('activityLog.credit')}</th>
                      <th colSpan={2} className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[14%]">{t('activityLog.debit')}</th>
                      <th colSpan={4} className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[23%]">{t('activityLog.weight')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[6%]">
                        {t('activityLog.balance').includes('(') ? t('activityLog.balance').split(' (')[0] : t('activityLog.balance')}
                        <br />
                        ({t('activityLog.balance').includes('(') ? t('activityLog.balance').split('(')[1] : 'GH¢)'}
                      </th>
                      {/* signature column */}
                      <th className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[7%]">{"Signature"}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[10px] font-bold text-blue-600 text-center w-[7%]">{t('activityLog.action')}</th>
                    </tr>
                    <tr className="bg-blue-50">
                      <th className="border border-blue-600"></th>
                      <th className="border border-blue-600"></th>
                      <th className="border border-blue-600"></th>
                      <th className="border border-blue-600"></th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[9px] font-semibold text-blue-600 text-center">{t('activityLog.credit')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[9px] font-semibold text-blue-600 text-center">{t('activityLog.cumCredit')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[9px] font-semibold text-blue-600 text-center">{t('activityLog.debit')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[9px] font-semibold text-blue-600 text-center">{t('activityLog.cumDebit')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[9px] font-semibold text-blue-600 text-center">{t('activityLog.mts')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[9px] font-semibold text-blue-600 text-center">{t('activityLog.cumMts')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[9px] font-semibold text-blue-600 text-center">{t('activityLog.bags')}</th>
                      <th className="border border-blue-600 px-0.5 py-1 text-[9px] font-semibold text-blue-600 text-center">{t('activityLog.cumBags')}</th>
                      <th className="border border-blue-600"></th>
                      <th className="border border-blue-600"></th>
                    </tr>

                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      // const itemCredit = parseFloat(item.credit_amount) || 0;
                      // const itemDebit = parseFloat(item.debit_amount) || 0;
                      // const itemMts = parseFloat(item.mts) || 0;
                      // const itemBags = parseInt(item.bags) || 0;

                      // Calculate cumulative values up to this item
                      let cumCredit = cumulativeTotals.cumulative_credit;
                      let cumDebit = cumulativeTotals.cumulative_debit;
                      let cumMts = cumulativeTotals.cumulative_mts;
                      let cumBags = cumulativeTotals.cumulative_bags;

                      for (let i = 0; i <= index; i++) {
                        cumCredit += parseFloat(items[i].credit_amount) || 0;
                        cumDebit += parseFloat(items[i].debit_amount) || 0;
                        cumMts += parseFloat(items[i].mts) || 0;
                        cumBags += parseInt(items[i].bags) || 0;
                      }

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-blue-600 p-0 h-px">
                            <Input
                              type="text"
                              value={item.serial_number}
                              onChange={(e) => updateItem(index, 'serial_number', e.target.value)}
                              className="w-full h-full min-h-full text-[10px] p-1 text-center bg-transparent border-0 focus:ring-0 rounded-none"
                            />
                          </td>
                          <td className="border border-blue-600 p-0 h-px">
                            <Input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(index, 'date', e.target.value)}
                              className="w-full h-full min-h-full text-[10px] p-1 text-center border-0 focus:ring-0 rounded-none"
                            />
                          </td>
                          <td className="border border-blue-600 p-0 h-px">
                            <Input
                              type="text"
                              value={item.whr_number}
                              onChange={(e) => updateItem(index, 'whr_number', e.target.value)}
                              autoComplete="off"
                              className="w-full h-full min-h-full text-[10px] p-1 text-center border-0 focus:ring-0 rounded-none"
                            />
                          </td>
                          <td className="border border-blue-600 p-0 h-px">
                            <Textarea
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              placeholder={t('activityLog.enterDescription')}
                              rows={2}
                              className="w-full h-full min-h-full text-[10px] border-0 focus:ring-0 focus:outline-none resize-none px-1 py-1 bg-transparent rounded-none"
                              style={{ overflow: 'hidden' }}
                            />
                          </td>
                          <td className="border border-blue-600 p-0 h-px">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={item.credit_amount}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                if (val.split('.').length <= 2) {
                                  updateItem(index, 'credit_amount', val);
                                }
                              }}
                              className="w-full h-full min-h-full text-[10px] p-1 border-0 focus:ring-0 text-center rounded-none"
                            />
                          </td>
                          <td className="border border-blue-600 p-0 h-px bg-gray-50 text-center text-[10px] px-1">
                            {cumCredit.toFixed(2)}
                          </td>
                          <td className="border border-blue-600 p-0 h-px">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={item.debit_amount}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                if (val.split('.').length <= 2) {
                                  updateItem(index, 'debit_amount', val);
                                }
                              }}
                              className="w-full h-full min-h-full text-[10px] p-1 border-0 focus:ring-0 text-center rounded-none"
                            />
                          </td>
                          <td className="border border-blue-600 p-0 h-px bg-gray-50 text-center text-[10px] px-1">
                            {cumDebit.toFixed(2)}
                          </td>
                          <td className="border border-blue-600 p-0 h-px">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={item.mts}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                if (val.split('.').length <= 2) {
                                  updateItem(index, 'mts', val);
                                }
                              }}
                              className="w-full h-full min-h-full text-[10px] p-1 border-0 focus:ring-0 text-center rounded-none"
                            />
                          </td>
                          <td className="border border-blue-600 p-0 h-px bg-gray-50 text-center text-[10px] px-1">
                            {cumMts.toFixed(2)}
                          </td>
                          <td className="border border-blue-600 p-0 h-px">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={item.bags}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                updateItem(index, 'bags', val);
                              }}
                              className="w-full h-full min-h-full text-[10px] p-1 border-0 focus:ring-0 text-center rounded-none"
                            />
                          </td>
                          <td className="border border-blue-600 p-0 h-px bg-gray-50 text-center text-[10px] px-1">
                            {cumBags.toString()}
                          </td>
                          <td className="border border-blue-600 p-0 h-px bg-gray-50 text-center text-[10px] px-1 font-semibold">
                            {item.balance_ghc}
                          </td>
                          <td className="border border-blue-600 p-0 h-px bg-gray-50 text-center text-[10px] px-1 font-semibold">
                            <Input
                              type="text"
                              inputMode='text'
                              value={item.signature || ''}
                              onChange={(e) => updateItem(index, 'signature', e.target.value)}
                              className="w-full h-full min-h-full text-[10px] p-1 border-0 focus:ring-0 text-center rounded-none"
                            />
                          </td>
                          <td className="border border-blue-600 px-0.5 py-1">
                            <div className="flex gap-0.5 justify-center">
                              <Button
                                type="button"
                                variant="success"
                                size="sm"
                                onClick={addItem}
                                title={t('activityLog.addRow')}
                                className="px-2 py-1 text-xs"
                              >
                                +
                              </Button>
                              {items.length > 1 && (
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={() => removeItem(index)}
                                  title={t('activityLog.removeRow')}
                                  className="px-2 py-1 text-xs"
                                >
                                  ×
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-bold text-blue-600 mb-3">Previous Balance (Outstanding from Previous Stock Card)</h3>
              <Input
                type="number"
                step="0.01"
                value={formData.previous_balance}
                readOnly
                className="bg-white font-semibold text-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                This is automatically calculated from the most recent stock card for this LBA before the selected date.
              </p>
            </div>

            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Stock Card Totals (Auto-calculated)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="block text-xs font-medium text-gray-700 mb-1">
                    Total Credit (GH¢)
                  </span>
                  <span className="block text-sm text-gray-900 font-medium">
                    {formData.credit_amount}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700 mb-1">
                    Total Debit (GH¢)
                  </span>
                  <span className="block text-sm text-gray-900 font-medium">
                    {formData.debit_amount}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700 mb-1">
                    Current Balance (GH¢)
                  </span>
                  <span className="block text-sm text-gray-900 font-semibold">
                    {formData.balance_ghc}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700 mb-1">
                    Total MTS
                  </span>
                  <span className="block text-sm text-gray-900 font-medium">
                    {formData.mts}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700 mb-1">
                    Total Bags
                  </span>
                  <span className="block text-sm text-gray-900 font-medium">
                    {formData.bags}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700 mb-1">
                    Cumulative Credit (GH¢)
                  </span>
                  <span className="block text-sm text-gray-900 font-semibold">
                    {cumulativeCredit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div> */}

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={submitting}
                disabled={submitting}
              >
                {t('nav.createReceipt')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
