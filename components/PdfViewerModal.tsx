'use client';

import { useRef, useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui';

interface PdfViewerModalProps {
  pdfBlobUrl: string;
  receiptId: string | number;
  onClose: () => void;
}

export default function PdfViewerModal({ pdfBlobUrl, receiptId, onClose }: PdfViewerModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    if (!pdfBlobUrl) return;

    // Method 1: Try printing from iframe
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.focus();
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      } catch (error) {
        console.log('Iframe print failed, trying new window:', error);
      }
    }

    // Method 2: Open PDF in new window and print (most reliable)
    try {
      const printWindow = window.open(pdfBlobUrl, '_blank');
      if (printWindow) {
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (printError) {
            console.error('Print error:', printError);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error opening print window:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">
          Print - {receiptId}
        </h2>
        <div className="flex items-center gap-3">
          <Button
            onClick={handlePrint}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Printer className="h-5 w-5" />
            Print
          </Button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Viewer - Using iframe with browser's native PDF viewer */}
      <div className="flex-1 w-full h-full overflow-hidden bg-gray-100">
        <iframe
          ref={iframeRef}
          src={pdfBlobUrl}
          className="w-full h-full border-0"
          title="PDF Viewer"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
