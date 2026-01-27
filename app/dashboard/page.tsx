/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import StatsCard from '@/components/StatsCard';
import { useDialog } from '@/components/ui';
import { getDashboardStats, getAllReceipts } from '@/lib/receipts';
import type { ReceiptWithUnit } from '@/types';

function DashboardPageContent() {
  const router = useRouter();
  const { showAlert } = useDialog();
  const [stats, setStats] = useState({
    totalCredit: 0,
    totalDebit: 0,
    totalBalance: 0,
    totalWeight: 0,
    totalBags: 0,
    totalMTS: 0,
  });
  const [recentReceipts, setRecentReceipts] = useState<ReceiptWithUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [dashboardStats, receipts] = await Promise.all([
        getDashboardStats(),
        getAllReceipts(),
      ]);
      setStats(dashboardStats);
      setRecentReceipts(receipts.slice(0, 10));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      await showAlert('Error loading dashboard data. Make sure you are running in Tauri environment.');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-GH').format(value);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <StatsCard
            title="Total Credit"
            value={formatCurrency(stats.totalCredit)}
          />
          <StatsCard
            title="Total Debit"
            value={formatCurrency(stats.totalDebit)}
          />
          <StatsCard
            title="Total Balance"
            value={formatCurrency(stats.totalBalance)}
          />
          <StatsCard
            title="Total Weight"
            value={formatNumber(stats.totalWeight)}
            subtitle="kg"
          />
          <StatsCard
            title="Total Bags"
            value={formatNumber(stats.totalBags)}
          />
          <StatsCard
            title="Total MTS"
            value={formatNumber(stats.totalMTS)}
          />
        </div>

        {/* Recent Receipts */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Stock Cards
            </h3>
          </div>
          {recentReceipts.length === 0 ? (
            <div className="px-4 py-5 sm:px-6 text-center text-gray-500">
              No stock cards found. Create your first stock card to get started.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentReceipts.map((receipt) => (
                <li
                  key={receipt.id}
                  className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/receipts/view?id=${receipt.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {receipt.whr_number} - {receipt.description}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {receipt.unit_name} • {receipt.date}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(receipt.balance_ghc)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {receipt.bags} bags • {formatNumber(receipt.mts)} MTS
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardPageContent />
    </ProtectedRoute>
  );
}
