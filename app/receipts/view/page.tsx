'use client';

import { useSearchParams } from 'next/navigation';
import ReceiptDetailClient from './ReceiptDetailClient';
import { Suspense } from 'react';

function ReceiptDetailContent() {
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id');
  const receiptId = idStr ? parseInt(idStr) : 0;

  return <ReceiptDetailClient receiptId={receiptId} />;
}

export default function ReceiptDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading stock card...</div>}>
      <ReceiptDetailContent />
    </Suspense>
  );
}
