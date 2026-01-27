'use client';

import { useSearchParams } from 'next/navigation';
import EditReceiptClient from './EditReceiptClient';
import { Suspense } from 'react';

function EditReceiptContent() {
  const searchParams = useSearchParams();
  const idStr = searchParams.get('id');
  const receiptId = idStr ? parseInt(idStr) : 0;

  return <EditReceiptClient receiptId={receiptId} />;
}

export default function EditReceiptPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading editor...</div>}>
      <EditReceiptContent />
    </Suspense>
  );
}
