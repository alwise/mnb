/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Printer, DownloadCloud, X } from 'lucide-react';
import { Button, useDialog } from '@/components/ui';
import { getReceiptById, getReceiptTotals, deleteReceipt } from '@/lib/receipts';
import { getReceiptPhotoDataUrl } from '@/lib/settings';
import { getCompanySettings, getCompanyLogoDataUrl } from '@/lib/company';
import { getUserSignatureDataUrl } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { isTauri } from '@/lib/utils';
import type { ReceiptWithUnit, ReceiptItem } from '@/types';
import { useTexts } from '@/hooks/useTexts';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';
import PdfViewerModal from '@/components/PdfViewerModal';

interface ParsedReceiptItem extends ReceiptItem {
  serial_number: string;
  date: string;
  whr_number: string;
  description_only: string;
}

export default function ReceiptDetailClient({ receiptId }: { receiptId: number }) {
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();
  const { user } = useAuth();
  const { t } = useTexts();
  const queryClient = useQueryClient();
  const [receipt, setReceipt] = useState<ReceiptWithUnit | null>(null);
  const [totals, setTotals] = useState({
    cumulative_credit: 0,
    cumulative_debit: 0,
    cumulative_mts: 0,
    cumulative_bags: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [userSignature, setUserSignature] = useState<string | null>(null);
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedReceiptItem[]>([]);
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [hasPrinters, setHasPrinters] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyDetails, setCompanyDetails] = useState({
    name: 'MAN NO BE GOD COMPANY LIMITED',
    headerText: 'MAN NO BE GOD COMPANY LIMITED',
    address: '',
    phone: '',
    email: '',
    website: '',
  });

  // Parse receipt item description to extract serial number, date, WHR number
  function parseReceiptItem(item: ReceiptItem, index: number, receiptDate: string, receiptWHR: string): ParsedReceiptItem {
    const description = item.description || '';

    // Format: "1. Description (WHR: WHR-001, Date: 2024-01-01)"
    const serialMatch = description.match(/^(\d+)\./);
    const serial_number = serialMatch ? serialMatch[1] : (index + 1).toString();

    const whrMatch = description.match(/WHR:\s*([^,)]+)/);
    const whr_number = whrMatch ? whrMatch[1].trim() : receiptWHR;

    const dateMatch = description.match(/Date:\s*([^)]+)/);
    const date = dateMatch ? dateMatch[1].trim() : receiptDate;

    // Extract description only (between "." and "(")
    const descMatch = description.match(/^\d+\.\s*(.+?)\s*\(/);
    const description_only = descMatch
      ? descMatch[1].trim()
      : description.replace(/^\d+\.\s*/, '').replace(/\s*\(.*\)$/, '').trim() || description;

    return {
      ...item,
      serial_number,
      date: date || receiptDate,
      whr_number: whr_number || receiptWHR,
      description_only,
    };
  }

  const loadReceipt = useCallback(async () => {
    if (!receiptId) return;

    try {
      setLoading(true);
      // Load user signature if user is logged in
      const signaturePromise = user
        ? getUserSignatureDataUrl(user.id).catch(() => null)
        : Promise.resolve(null);

      const [receiptData, signature, photo, companySettings, logo] = await Promise.all([
        getReceiptById(receiptId),
        signaturePromise,
        getReceiptPhotoDataUrl(receiptId).catch(() => null),
        getCompanySettings(),
        getCompanyLogoDataUrl().catch(() => null),
      ]);

      if (!receiptData) {
        await showAlert(t('receipts.stockCardNotFound'));
        router.push('/receipts');
        return;
      }
      setReceipt(receiptData);
      setUserSignature(signature);
      setReceiptPhoto(photo);

      // Set company settings
      if (companySettings) {
        setCompanyDetails({
          name: companySettings.company_name,
          headerText: companySettings.receipt_header_text,
          address: companySettings.address || '',
          phone: companySettings.phone || '',
          email: companySettings.email || '',
          website: companySettings.website || '',
        });
      }
      if (logo) {
        setCompanyLogo(logo);
      }

      // Parse receipt items
      if (receiptData.items && receiptData.items.length > 0) {
        const parsed = receiptData.items.map((item, index) =>
          parseReceiptItem(item, index, receiptData.date, receiptData.whr_number)
        );
        setParsedItems(parsed);
      } else {
        // If no items, create a single item from receipt data
        setParsedItems([{
          id: 0,
          receipt_id: receiptData.id || 0,
          description: receiptData.description,
          credit_amount: receiptData.credit_amount,
          debit_amount: receiptData.debit_amount,
          weight: receiptData.weight,
          mts: receiptData.mts,
          bags: receiptData.bags,
          item_order: 0,
          serial_number: '1',
          date: receiptData.date,
          whr_number: receiptData.whr_number,
          description_only: receiptData.description,
        }]);
      }

      // Get cumulative totals up to this receipt's date
      const totalsData = await getReceiptTotals(receiptData.lba_unit_id);
      if (totalsData) {
        // Calculate cumulative totals up to (but not including) this receipt
        // We need to subtract this receipt's values to get the previous cumulative
        const previousCumulative = {
          cumulative_credit: totalsData.cumulative_credit - receiptData.credit_amount,
          cumulative_debit: totalsData.cumulative_debit - receiptData.debit_amount,
          cumulative_mts: totalsData.cumulative_mts - receiptData.mts,
          cumulative_bags: totalsData.cumulative_bags - receiptData.bags,
        };
        setTotals(previousCumulative);
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
      await showAlert(t('receipts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [receiptId, router, showAlert, user]);

  useEffect(() => {
    loadReceipt();
  }, [loadReceipt]);

  // Check for available printers on mount
  useEffect(() => {
    async function checkPrinters() {
      if (!isTauri()) {
        return;
      }

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const printerList: string[] = await invoke('get_printers');
        if (printerList && printerList.length > 0) {
          // Convert string array to object array for compatibility
          const printers = printerList.map((name) => ({ id: name, name }));
          setAvailablePrinters(printers);
          setHasPrinters(true);
        }
      } catch (error) {
        console.error('Error checking printers:', error);
        // If printer detection fails, continue without direct printing
        setHasPrinters(false);
      }
    }

    checkPrinters();
  }, []);

  async function handleDelete() {
    const confirmed = await showConfirm(t('receipts.deleteConfirm', 'Are you sure you want to delete this stock card? This action cannot be undone.'));
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      await deleteReceipt(receiptId);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts.list() });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts.paginated() });
      await showAlert(t('receipts.deleteSuccess'));
      router.replace('/receipts');
    } catch (error) {
      console.error('Error deleting receipt:', error);
      await showAlert(t('receipts.deleteError'));
    } finally {
      setDeleting(false);
    }
  }

  function handlePrint() {
    // window.print() doesn't work in Tauri webview
    // In browser, use native print dialog
    if (!isTauri()) {
      window.print();
    }
  }

  async function handlePrintWithDialog() {
    if (!receipt) return;

    try {
      setPrinting(true);

      // Generate PDF first
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;

      const receiptContent = document.getElementById('receipt-content');
      if (!receiptContent) {
        await showAlert(t('receipts.stockCardNotFound'));
        return;
      }

      // Convert HTML to canvas
      const canvas = await html2canvas(receiptContent, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;

      // Calculate centering
      const xOffset = (pdfWidth - imgScaledWidth) / 2;
      const yOffset = (pdfHeight - imgScaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight);

      // Create blob URL from PDF
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);

      // Set the blob URL and open the PDF viewer
      setPdfBlobUrl(blobUrl);
      setPdfViewerOpen(true);
    } catch (error) {
      console.error('Error generating PDF:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error) || 'Unknown error';
      await showAlert(t('receipts.printError') + ': ' + errorMessage);
    } finally {
      setPrinting(false);
    }
  }

  function handleClosePdfViewer() {
    setPdfViewerOpen(false);
    // Clean up blob URL to free memory
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  }

  async function handleExportPDF() {
    if (!receipt) return;

    try {
      setExporting(true);

      // Dynamically import libraries
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;

      const receiptContent = document.getElementById('receipt-content');
      if (!receiptContent) {
        await showAlert(t('receipts.stockCardNotFound'));
        return;
      }

      // Convert HTML to canvas
      const canvas = await html2canvas(receiptContent, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;

      // Calculate centering
      const xOffset = (pdfWidth - imgScaledWidth) / 2;
      const yOffset = (pdfHeight - imgScaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight);

      // Generate filename
      const dateStr = receipt.date.replace(/\//g, '-');
      const filename = `Receipt_${receipt.whr_number || receipt.id}_${dateStr}.pdf`;

      if (isTauri()) {
        // Use Tauri dialog to save file
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');

        const filePath = await save({
          defaultPath: filename,
          filters: [
            {
              name: 'PDF',
              extensions: ['pdf'],
            },
          ],
        });

        if (filePath) {
          const pdfBlob = pdf.output('arraybuffer');
          // filePath from save dialog is an absolute path, so no baseDir needed
          await writeFile(filePath, new Uint8Array(pdfBlob));
          await showAlert(t('receipts.pdfExportSuccess'));
        }
      } else {
        // Fallback for browser: download directly
        pdf.save(filename);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      await showAlert(t('receipts.pdfExportError'));
    } finally {
      setExporting(false);
    }
  }

  async function handleDirectPrint() {
    if (!receipt || !hasPrinters || availablePrinters.length === 0) {
      return;
    }

    try {
      setPrinting(true);

      // Generate PDF first
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;

      const receiptContent = document.getElementById('receipt-content');
      if (!receiptContent) {
        await showAlert(t('receipts.stockCardNotFound'));
        return;
      }

      // Convert HTML to canvas
      const canvas = await html2canvas(receiptContent, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;

      // Calculate centering
      const xOffset = (pdfWidth - imgScaledWidth) / 2;
      const yOffset = (pdfHeight - imgScaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight);

      // Import required modules
      const { invoke } = await import('@tauri-apps/api/core');
      const { writeFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');

      // Use the first available printer (or default)
      const printerName = availablePrinters[0]?.name || availablePrinters[0]?.id;

      // Create temp directory if it doesn't exist
      const tempDir = 'temp';
      try {
        await mkdir(tempDir, { baseDir: BaseDirectory.AppData, recursive: true });
      } catch (err) {
        // Directory might already exist, that's okay
        const errMsg = (err as Error).message || '';
        if (!errMsg.includes('exists') && !errMsg.includes('already exists') && !errMsg.includes('EEXIST')) {
          throw err;
        }
      }

      // Save PDF to temporary file
      const dateStr = receipt.date.replace(/\//g, '-');
      const tempFilename = `temp_receipt_${receipt.whr_number || receipt.id}_${dateStr}.pdf`;
      const tempPath = `${tempDir}/${tempFilename}`;

      // Write PDF to temporary file
      const pdfBuffer = pdf.output('arraybuffer');
      await writeFile(tempPath, new Uint8Array(pdfBuffer), { baseDir: BaseDirectory.AppData });

      // Get absolute path for printing
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const appDir = await appDataDir();
      const absoluteTempPath = await join(appDir, tempPath);

      // Print the PDF directly using Tauri command
      await invoke('print_file', {
        path: absoluteTempPath,
        printerName: printerName || null,
      });

      // Clean up temporary file (optional - can be left for user to clean up)
      try {
        const { remove } = await import('@tauri-apps/plugin-fs');
        await remove(tempPath, { baseDir: BaseDirectory.AppData });
      } catch (cleanupError) {
        // Ignore cleanup errors
        console.log('Could not clean up temp file:', cleanupError);
      }

      await showAlert(t('receipts.printSuccess'));
      setPrinting(false);
    } catch (error) {
      console.error('Error printing directly:', error);
      setPrinting(false);
      // Fallback to showing print dialog if direct print fails
      try {
        await handlePrintWithDialog();
      } catch (fallbackError) {
        console.error('Fallback print dialog also failed:', fallbackError);
        const errorMessage = fallbackError instanceof Error
          ? fallbackError.message
          : typeof fallbackError === 'string'
            ? fallbackError
            : String(fallbackError) || 'Unknown error';
        await showAlert(t('receipts.printError') + ': ' + errorMessage);
      }
    }
  }

  async function handlePrintClick() {
    if (isTauri()) {
      // Generate PDF and open Windows print dialog
      await handlePrintWithDialog();
    } else {
      // Use browser's native print dialog
      handlePrint();
    }
  }

  async function handleExportClick() {
    if (isTauri()) {
      await handleExportPDF();
    } else {
      handlePrint();
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center py-12">
            <p className="text-gray-600">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return null;
  }

  // Calculate cumulative values for each row
  const itemsWithCumulative = parsedItems.map((item, index) => {
    let cumCredit = totals.cumulative_credit;
    let cumDebit = totals.cumulative_debit;
    let cumMts = totals.cumulative_mts;
    let cumBags = totals.cumulative_bags;

    // Add all items up to and including this one
    for (let i = 0; i <= index; i++) {
      cumCredit += parsedItems[i].credit_amount || 0;
      cumDebit += parsedItems[i].debit_amount || 0;
      cumMts += parsedItems[i].mts || 0;
      cumBags += parsedItems[i].bags || 0;
    }

    // Calculate balance
    let runningBalance = receipt.previous_balance || 0;
    for (let i = 0; i <= index; i++) {
      runningBalance = runningBalance + (parsedItems[i].credit_amount || 0) - (parsedItems[i].debit_amount || 0);
    }

    return {
      ...item,
      cumulative_credit: cumCredit,
      cumulative_debit: cumDebit,
      cumulative_mts: cumMts,
      cumulative_bags: cumBags,
      balance_ghc: runningBalance,
    };
  });

  return (
    <>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">

          <div className="mb-6 flex items-center justify-end no-print">
            <div className="flex space-x-3">
              {/* Print Button - Always visible, uses Windows default print dialog */}
              <Button
                onClick={handlePrintClick}
                variant="primary"
                isLoading={printing}
                disabled={printing || exporting}
                className="flex items-center gap-2"
              >
                <Printer className="h-5 w-5" />
                {t('receipts.print')}
              </Button>
              {/* Export PDF Button */}
              <Button
                onClick={handleExportClick}
                variant="primary"
                isLoading={exporting}
                disabled={printing || exporting}
                className="flex items-center gap-2"
              >
                <DownloadCloud className="h-5 w-5" />
                {t('receipts.downloadPdf')}
              </Button>
              <Button
                onClick={() => router.push(`/receipts/edit?id=${receipt.id}`)}
                variant="success"
              >
                {t('common.edit')}
              </Button>
              <Button
                onClick={handleDelete}
                variant="danger"
                isLoading={deleting}
                disabled={deleting}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>

          {/* Receipt Display - Matches Printed Format */}
          <div className="bg-white shadow rounded-lg p-8 print:p-4 print:shadow-none" id="receipt-content">
            {/* Top Section: Header/Title Page */}
            <div className="mb-8 print:mb-6 text-center">
              {/* Logo */}
              {companyLogo && (
                <div className="flex justify-center mb-4 print:mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={companyLogo}
                    alt="Company Logo"
                    className="h-20 w-20 print:h-16 print:w-16 object-contain"
                  />
                </div>
              )}

              {/* Company Name - Light Blue */}
              <div className="text-center mb-3 print:mb-2">
                <h1 className="text-6xl print:text-2xl font-bold uppercase text-blue-600 print:text-blue-600 leading-tight">
                  {companyDetails.headerText.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < companyDetails.headerText.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </h1>
              </div>

              {/* Company Details (Address, Phone, etc) */}
              <div className="text-center mb-4 print:mb-3 text-blue-600 print:text-blue-600 text-sm print:text-xs">
                {companyDetails.address && <p>{companyDetails.address}</p>}
                <div className="flex justify-center gap-4 flex-wrap">
                  {companyDetails.phone && <span>Tel: {companyDetails.phone}</span>}
                  {companyDetails.email && <span>Email: {companyDetails.email}</span>}
                  {companyDetails.website && <span>Website: {companyDetails.website}</span>}
                </div>
              </div>

              {/* LBA STOCK SHEET - Light Blue */}
              <div className="text-center mb-3 print:mb-2">
                <h2 className="text-6xl print:text-2xl font-bold uppercase text-blue-600 print:text-blue-600">
                  {t('receipts.lbaStockSheet')}
                </h2>
              </div>

              {/* EDIBLE NUTS – CASHEW - Light Blue Underlined */}
              <div className="text-center mb-4 print:mb-3">
                <p className="text-xl print:text-base font-semibold text-blue-600 print:text-blue-600 underline">
                  {t('receipts.edibleNutsCashew')}
                </p>
              </div>

              {/* Secondary Seal/Logo - Bottom Right */}
              <div className="flex justify-end mt-8 print:mt-6">
                <div className="w-16 h-16 print:w-12 print:h-12 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="Company Seal"
                    className="h-16 w-16 print:h-12 print:w-12 object-contain grayscale"
                  />
                </div>
              </div>
            </div>

            {/* Separator Line */}
            <div className="border-t border-black mb-8 print:mb-6"></div>

            {/* Bottom Section: LBA Stock Card */}
            <div>

              {/* Photo and Unit Info */}
              <div className="grid grid-cols-3 gap-4 print:gap-3 border-b-2 border-blue-600 pb-4 print:pb-3 mb-4 print:mb-3">
                {/* Photo Area */}
                <div className="col-span-1">
                  <label className="block text-sm print:text-xs font-bold text-blue-600 mb-1 text-center">
                    {t('common.photo')}
                  </label>
                  <div className="border-2 border-dashed border-blue-600 p-2 print:p-1 h-64 print:h-32 flex items-center justify-center relative overflow-hidden bg-white">
                    {receiptPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={receiptPhoto}
                        alt="Receipt photo"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400 text-xs">
                        <p>{t('receipts.noPhoto')}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className='col-span-2'>
                  {/* Stock Card Header */}
                  <div className="mb-4 print:mb-3 text-center">
                    <h3 className="text-4xl print:text-lg font-bold uppercase text-blue-600 print:text-blue-600 mb-1">
                      {t('nav.companyName')}
                    </h3>
                    <h4 className="text-4xl print:text-lg font-bold uppercase text-blue-600 print:text-blue-600 underline">
                      {t('receipts.lbaStockCard')}
                    </h4>
                  </div>
                  {/* Unit Information Fields */}
                  <div className="space-y-4 print:space-y-1">
                    <div className="grid grid-cols-2 gap-6 print:gap-1">
                      <div className="flex items-end">
                        <span className="text-xs print:text-[10px] font-bold text-gray-900 mr-1">
                          {t('lbaUnit.unit').toUpperCase()}:
                        </span>
                        <span className="flex-1 border-b-2 border-dotted border-gray-900 pb-0.5 min-h-[18px] text-xs print:text-[10px] font-normal">
                          {receipt.unit || ''}
                        </span>
                      </div>
                      <div className="flex items-end">
                        <span className="text-xs print:text-[10px] font-bold text-gray-900 mr-1">{t('lbaUnit.lbaName')}:</span>
                        <span className="flex-1 border-b-2 border-dotted border-gray-900 pb-0.5 min-h-[18px] text-xs print:text-[10px] font-normal">
                          {receipt.lba_name || ''}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 print:gap-1">
                      <div className="flex items-end">
                        <span className="text-xs print:text-[10px] font-bold text-gray-900 mr-1">{t('lbaUnit.unitHead').toUpperCase()}:</span>
                        <span className="flex-1 border-b-2 border-dotted border-gray-900 pb-0.5 min-h-[18px] text-xs print:text-[10px] font-normal">
                          {receipt.unit_head || ''}
                        </span>
                      </div>
                      <div className="flex items-end">
                        <span className="text-xs print:text-[10px] font-bold text-gray-900 mr-1">{t('lbaUnit.crop').toUpperCase()}:</span>
                        <span className="flex-1 border-b-2 border-dotted border-gray-900 pb-0.5 min-h-[18px] text-xs print:text-[10px] font-normal">
                          {receipt.crop || ''}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 print:gap-1">
                      <div className="flex items-end">
                        <span className="text-xs print:text-[10px] font-bold text-gray-900 mr-1">{t('lbaUnit.qciName').toUpperCase()}:</span>
                        <span className="flex-1 border-b-2 border-dotted border-gray-900 pb-0.5 min-h-[18px] text-xs print:text-[10px] font-normal">
                          {receipt.qci_name || ''}
                        </span>
                      </div>
                      <div className="flex items-end">
                        <span className="text-xs print:text-[10px] font-bold text-gray-900 mr-1">{t('lbaUnit.season').toUpperCase()}:</span>
                        <span className="flex-1 border-b-2 border-dotted border-gray-900 pb-0.5 min-h-[18px] text-xs print:text-[10px] font-normal">
                          {receipt.season || ''}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 print:gap-1">
                      <div className="flex items-end">
                        <span className="text-xs print:text-[10px] font-bold text-gray-900 mr-1">{t('lbaUnit.lbaCode').toUpperCase()}:</span>
                        <span className="flex-1 border-b-2 border-dotted border-gray-900 pb-0.5 min-h-[18px] text-xs print:text-[10px] font-normal">
                          {receipt.lba_code || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Card Table */}
              <div className="mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full border-2 border-blue-600">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 w-[4%]">{t('activityLog.sn')}</th>
                        <th className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 w-[6%]">{t('activityLog.date')}</th>
                        <th className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 w-[6%]">{t('activityLog.whrNo')}</th>
                        <th className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 w-[20%]">{t('activityLog.description')}</th>
                        <th colSpan={2} className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 text-center w-[12%]">{t('activityLog.credit')}</th>
                        <th colSpan={2} className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 text-center w-[12%]">{t('activityLog.debit')}</th>
                        <th colSpan={4} className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 text-center w-[24%]">{t('activityLog.weight')}</th>
                        <th className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 text-center w-[6%]">
                          {t('activityLog.balance').includes('(') ? t('activityLog.balance').split(' (')[0] : t('activityLog.balance')}
                          <br />
                          ({t('activityLog.balance').includes('(') ? t('activityLog.balance').split('(')[1] : 'GH¢)'}
                        </th>
                        <th className="border border-blue-600 px-2 py-2 text-xs font-bold text-blue-600 text-center w-[6%]">
                          {t('receipts.lbaSignature').includes(' ') ? t('receipts.lbaSignature').split(' ')[0] : t('receipts.lbaSignature')}
                          <br />
                          ({t('receipts.lbaSignature').includes(' ') ? t('receipts.lbaSignature').split(' ')[1] : 'Signature'})
                        </th>
                      </tr>
                      <tr className="bg-blue-50">
                        <th className="border border-blue-600"></th>
                        <th className="border border-blue-600"></th>
                        <th className="border border-blue-600"></th>
                        <th className="border border-blue-600"></th>
                        <th className="border border-blue-600 px-1 py-1 text-xs font-semibold text-blue-600">{t('activityLog.credit')}</th>
                        <th className="border border-blue-600 px-1 py-1 text-xs font-semibold text-blue-600">{t('activityLog.cumCredit')}</th>
                        <th className="border border-blue-600 px-1 py-1 text-xs font-semibold text-blue-600">{t('activityLog.debit')}</th>
                        <th className="border border-blue-600 px-1 py-1 text-xs font-semibold text-blue-600">{t('activityLog.cumDebit')}</th>
                        <th className="border border-blue-600 px-1 py-1 text-xs font-semibold text-blue-600">{t('activityLog.mts')}</th>
                        <th className="border border-blue-600 px-1 py-1 text-xs font-semibold text-blue-600">{t('activityLog.cumMts')}</th>
                        <th className="border border-blue-600 px-1 py-1 text-xs font-semibold text-blue-600">{t('activityLog.bags')}</th>
                        <th className="border border-blue-600 px-1 py-1 text-xs font-semibold text-blue-600">{t('activityLog.cumBags')}</th>
                        <th className="border border-blue-600"></th>
                        <th className="border border-blue-600"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsWithCumulative.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-gray-50">
                          <td className="border border-blue-600 px-2 py-1 text-xs text-center">
                            {item.serial_number}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 text-xs">
                            {item.date}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 text-xs">
                            {item.whr_number || 'N/A'}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 align-top text-xs">
                            {item.description_only || item.description}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 text-xs text-right">
                            {(item.credit_amount || 0).toFixed(2)}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 bg-gray-50 text-xs text-right">
                            {item.cumulative_credit.toFixed(2)}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 text-xs text-right">
                            {(item.debit_amount || 0).toFixed(2)}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 bg-gray-50 text-xs text-right">
                            {item.cumulative_debit.toFixed(2)}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 text-xs text-right">
                            {(item.mts || 0).toFixed(2)}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 bg-gray-50 text-xs text-right">
                            {item.cumulative_mts.toFixed(2)}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 text-xs text-right">
                            {(item.bags || 0).toString()}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 bg-gray-50 text-xs text-right">
                            {item.cumulative_bags.toString()}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 bg-gray-50 text-xs text-right font-semibold">
                            {item.balance_ghc.toFixed(2)}
                          </td>
                          <td className="border border-blue-600 px-2 py-1 text-center">
                            {/* LBA signature - blank space for printing/manual signature */}
                            {receipt.signature && receipt.signature !== 'User Signature' ? (
                              <span className="text-xs">{receipt.signature}</span>
                            ) : (
                              <span className="text-xs text-gray-400">&nbsp;</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User and LBA Signature Section */}
              <div className='flex justify-center items-center mt-6 print:mt-4 pt-4 print:pt-3 border-t-2 border-blue-600'>
                {/* User Signature */}
                <div className='mt-6'>
                  <div className="flex">
                    <div className="text-right w-64 print:w-56">
                      <div className="mb-1 border-b-2 border-gray-900 pb-2 print:pb-1 min-h-[50px] print:min-h-[40px] flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {userSignature && (
                          <img
                            src={userSignature}
                            alt="User Signature"
                            className="max-w-full max-h-12 print:max-h-10 object-contain"
                          />
                        )}
                      </div>
                      <p className="text-center text-xs print:text-[10px] font-bold text-gray-900 uppercase tracking-wide mt-1">{t('receipts.userSignature')}</p>
                      <p className="text-center text-xs print:text-[10px] text-gray-600 mt-0.5">{t('receipts.authorizedSignatory')}</p>
                    </div>
                  </div>
                </div>
                {/* LBA Signature */}
                {/* <div>
                  <div className="flex justify-end">
                    <div className="text-right w-64 print:w-56">
                      <div className="mb-1 border-b-2 border-gray-900 pb-2 print:pb-1 min-h-[50px] print:min-h-[40px] flex items-end justify-center">
                      </div>
                      <p className="text-xs print:text-[10px] font-bold text-gray-900 uppercase tracking-wide mt-1">LBA Signature</p>
                      <p className="text-xs print:text-[10px] text-gray-600 mt-0.5">Authorized Signature</p>
                    </div>
                  </div>
                </div> */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewerOpen && pdfBlobUrl && receipt && (
        <PdfViewerModal
          pdfBlobUrl={pdfBlobUrl}
          receiptId={receipt.whr_number ?? receipt.id ?? 'Unknown'}
          onClose={handleClosePdfViewer}
        />
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-content,
          #receipt-content * {
            visibility: visible;
          }
          #receipt-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 0.5cm;
          }
          nav,
          button,
          .no-print {
            display: none !important;
          }
          /* Ensure proper spacing for print */
          #receipt-content table {
            page-break-inside: avoid;
          }
          #receipt-content tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}
