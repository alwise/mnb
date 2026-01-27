'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  createBackup,
  restoreBackup,
  deleteAccount,
  resetAllData,
} from '@/lib/data-management';
import { Button, useDialog } from '@/components/ui';

function DataManagementPageContent() {
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();
  const { user, logout } = useAuth();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleBackup() {
    try {
      setBackingUp(true);
      const filePath = await createBackup();
      await showAlert(
        `Backup created successfully!\n\nSaved to: ${filePath}\n\nYou can use this file to restore your data later.`,
        'Backup Successful'
      );
    } catch (error) {
      console.error('Error creating backup:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(
        `Error creating backup: ${errorMessage}\n\nMake sure you are running the app in Tauri environment and have some data to backup.`,
        'Backup Failed'
      );
    } finally {
      setBackingUp(false);
    }
  }

  async function handleRestore() {
    const confirmed = await showConfirm(
      '⚠️ WARNING: Restoring a backup will:\n' +
      '- Replace your current database with the backup\n' +
      '- Replace all files (signatures, photos, logos) with the backup versions\n' +
      '- You will lose any data created after the backup was made\n\n' +
      'Are you sure you want to continue?',
      'Restore Backup'
    );

    if (!confirmed) {
      return;
    }

    try {
      setRestoring(true);
      await restoreBackup();
      await showAlert(
        'Backup restored successfully!\n\nThe app will reload to apply the changes.',
        'Restore Successful'
      );
      // Reload the page to refresh all data
      window.location.reload();
    } catch (error) {
      console.error('Error restoring backup:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(
        `Error restoring backup: ${errorMessage}\n\nMake sure you selected a valid backup file.`,
        'Restore Failed'
      );
    } finally {
      setRestoring(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) {
      await showAlert('You must be logged in to delete your account.');
      return;
    }

    const confirmed = await showConfirm(
      '⚠️ WARNING: Deleting your account will:\n' +
      '- Permanently delete your user account\n' +
      '- Delete your profile photo and signature\n' +
      '- You will be logged out immediately\n' +
      '- This action CANNOT be undone\n\n' +
      'Note: Stock cards and LBA units will remain, but you will not be able to access them.\n\n' +
      'Are you absolutely sure you want to delete your account?',
      'Delete Account'
    );

    if (!confirmed) {
      return;
    }

    // Double confirmation
    const doubleConfirmed = await showConfirm(
      'This is your last chance to cancel.\n\n' +
      'Type "DELETE" in your mind and confirm one more time.\n\n' +
      'Are you absolutely certain?',
      'Final Confirmation'
    );

    if (!doubleConfirmed) {
      return;
    }

    try {
      setDeletingAccount(true);
      await deleteAccount(user.id);
      await showAlert(
        'Your account has been deleted successfully.\n\nYou will be redirected to the login page.',
        'Account Deleted'
      );
      logout();
      router.push('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(
        `Error deleting account: ${errorMessage}`,
        'Delete Failed'
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handleResetAllData() {
    const confirmed = await showConfirm(
      '⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️\n\n' +
      'This will PERMANENTLY DELETE:\n' +
      '- ALL LBA units\n' +
      '- ALL stock cards\n' +
      '- ALL cumulative totals\n' +
      '- ALL user accounts\n' +
      '- ALL settings\n' +
      '- ALL files (signatures, photos, logos)\n\n' +
      'This action CANNOT be undone!\n\n' +
      'The database will be recreated empty after deletion.\n\n' +
      'Are you absolutely sure you want to reset all data?',
      'Reset All Data'
    );

    if (!confirmed) {
      return;
    }

    // Triple confirmation for this dangerous operation
    const doubleConfirmed = await showConfirm(
      'This will delete EVERYTHING.\n\n' +
      'Are you REALLY sure?',
      'Second Confirmation'
    );

    if (!doubleConfirmed) {
      return;
    }

    const tripleConfirmed = await showConfirm(
      'Last chance to cancel.\n\n' +
      'This is irreversible.\n\n' +
      'Final confirmation?',
      'Final Confirmation'
    );

    if (!tripleConfirmed) {
      return;
    }

    try {
      setResetting(true);
      await resetAllData();
      await showAlert(
        'All data has been reset successfully!\n\nThe app will reload to apply the changes.',
        'Reset Complete'
      );
      // Logout and reload
      logout();
      window.location.reload();
    } catch (error) {
      console.error('Error resetting data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(
        `Error resetting data: ${errorMessage}`,
        'Reset Failed'
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Data Management</h1>
        <p className="text-gray-600 mb-8">
          Manage your data backups, restore from backups, delete your account, or reset all data.
        </p>

        {/* Backup Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-blue-500">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Backup Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            Create a backup of all your data including the database, signatures, photos, and logos.
            You can use this backup to restore your data later.
          </p>
          <Button
            onClick={handleBackup}
            variant="primary"
            isLoading={backingUp}
            disabled={backingUp}
          >
            {backingUp ? 'Creating Backup...' : 'Create Backup'}
          </Button>
        </div>

        {/* Restore Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-green-500">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Restore Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            Restore your data from a previously created backup file. This will replace your current
            data with the backup data.
          </p>
          <Button
            onClick={handleRestore}
            variant="success"
            isLoading={restoring}
            disabled={restoring}
          >
            {restoring ? 'Restoring...' : 'Restore from Backup'}
          </Button>
        </div>

        {/* Delete Account Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-orange-500">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Delete Account</h2>
          <p className="text-sm text-gray-600 mb-4">
            Permanently delete your user account. This will remove your account, profile photo,
            and signature. You will be logged out immediately. Stock cards and LBA units will remain
            in the system but you will not be able to access them.
          </p>
          <Button
            onClick={handleDeleteAccount}
            variant="danger"
            isLoading={deletingAccount}
            disabled={deletingAccount || !user}
          >
            {deletingAccount ? 'Deleting Account...' : 'Delete My Account'}
          </Button>
          {!user && (
            <p className="mt-2 text-sm text-gray-500">
              You must be logged in to delete your account.
            </p>
          )}
        </div>

        {/* Reset All Data Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-red-600">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset All Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            ⚠️ DANGER ZONE ⚠️
            <br />
            This will permanently delete ALL data including all LBA units, stock cards, user accounts,
            settings, and files. The database will be recreated empty. This action cannot be undone.
          </p>
          <Button
            onClick={handleResetAllData}
            variant="danger"
            isLoading={resetting}
            disabled={resetting}
          >
            {resetting ? 'Resetting...' : 'Reset All Data'}
          </Button>
          <p className="mt-2 text-xs text-red-600">
            ⚠️ This action cannot be undone! Make sure you have a backup before proceeding.
          </p>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Create regular backups to protect your data</li>
            <li>Store backups in a safe location (external drive, cloud storage, etc.)</li>
            <li>Before resetting all data, make sure you have a recent backup</li>
            <li>Backup files are JSON format and can be opened in any text editor</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function DataManagementPage() {
  return (
    <ProtectedRoute>
      <DataManagementPageContent />
    </ProtectedRoute>
  );
}
