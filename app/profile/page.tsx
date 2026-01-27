/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserProfilePhotoDataUrl,
  getUserSignatureDataUrl,
  uploadUserProfilePhoto,
  uploadUserSignature,
  updateUserProfile,
} from '@/lib/auth';
import {
  getCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo,
  getCompanyLogoDataUrl,
} from '@/lib/company';
import { Input, Button, ImagePicker, useDialog } from '@/components/ui';
import CameraCapture from '@/components/ui/CameraCapture';
import ImageSourceDialog from '@/components/ui/ImageSourceDialog';
import ImageCrop from '@/components/ui/ImageCrop';
import { User, PenTool, Save, Edit2, Check, X, Mail, Camera, Upload } from 'lucide-react';
import {
  createBackup,
  restoreBackup,
  deleteAccount,
  resetAllData,
} from '@/lib/data-management';

export default function ProfilePage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();
  const { user, refreshUser, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'user' | 'business' | 'data'>('user');
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [userData, setUserData] = useState({
    full_name: '',
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showProfileCamera, setShowProfileCamera] = useState(false);
  const [showSignatureCamera, setShowSignatureCamera] = useState(false);
  const [showProfileSourceDialog, setShowProfileSourceDialog] = useState(false);
  const [showSignatureSourceDialog, setShowSignatureSourceDialog] = useState(false);
  const [profileImageToCrop, setProfileImageToCrop] = useState<string | null>(null);
  const [signatureImageToCrop, setSignatureImageToCrop] = useState<string | null>(null);

  const [companyData, setCompanyData] = useState({
    company_name: '',
    receipt_header_text: '',
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router]);

  async function loadData() {
    try {
      setLoading(true);
      if (user) {
        setUserData({ full_name: user.full_name });

        const photo = await getUserProfilePhotoDataUrl(user.id);
        if (photo) setProfilePhotoPreview(photo);

        const signature = await getUserSignatureDataUrl(user.id);
        if (signature) setSignaturePreview(signature);
      }

      const settings = await getCompanySettings();
      if (settings) {
        setCompanyData({
          company_name: settings.company_name,
          receipt_header_text: settings.receipt_header_text,
        });

        const logo = await getCompanyLogoDataUrl();
        if (logo) setLogoPreview(logo);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      await showAlert('Error loading profile data. Make sure you are running in Tauri environment.');
    } finally {
      setLoading(false);
    }
  }

  async function handleProfilePhotoChange(file: File | null) {
    if (!file || !user) return;

    try {
      setSaving(true);
      await uploadUserProfilePhoto(user.id, file);
      const photo = await getUserProfilePhotoDataUrl(user.id);
      if (photo) setProfilePhotoPreview(photo);
      await showAlert('Profile photo updated successfully!');
      await refreshUser();
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      await showAlert('Error uploading profile photo.');
    } finally {
      setSaving(false);
    }
  }

  function handleCameraClick() {
    setShowProfileSourceDialog(true);
  }

  function handleSignatureClick() {
    setShowSignatureSourceDialog(true);
  }

  function handleFileSelect(callback: (file: File) => void, enableCrop: boolean = true) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (enableCrop) {
          // Read file as data URL for cropping
          const reader = new FileReader();
          reader.onloadend = () => {
            if (callback === handleProfilePhotoChange) {
              setProfileImageToCrop(reader.result as string);
            } else {
              setSignatureImageToCrop(reader.result as string);
            }
          };
          reader.readAsDataURL(file);
        } else {
          callback(file);
        }
      }
    };
    input.click();
  }

  function handleProfilePhotoCapture(file: File) {
    handleProfilePhotoChange(file);
  }

  function handleSignatureCapture(file: File) {
    handleSignatureChange(file);
  }

  function handleProfileCropComplete(croppedFile: File) {
    handleProfilePhotoChange(croppedFile);
    setProfileImageToCrop(null);
  }

  function handleSignatureCropComplete(croppedFile: File) {
    handleSignatureChange(croppedFile);
    setSignatureImageToCrop(null);
  }

  async function handleSignatureChange(file: File | null) {
    if (!file || !user) return;

    try {
      setSaving(true);
      await uploadUserSignature(user.id, file);
      const signature = await getUserSignatureDataUrl(user.id);
      if (signature) setSignaturePreview(signature);
      await showAlert('Signature updated successfully!');
      await refreshUser();
    } catch (error) {
      console.error('Error uploading signature:', error);
      await showAlert('Error uploading signature.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return;

    try {
      setSaving(true);
      await uploadCompanyLogo(file);
      const logo = await getCompanyLogoDataUrl();
      if (logo) setLogoPreview(logo);
      await showAlert('Company logo updated successfully!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      await showAlert('Error uploading company logo.');
    } finally {
      setSaving(false);
    }
  }

  function handleStartEditName() {
    setTempName(userData.full_name);
    setIsEditingName(true);
  }

  function handleCancelEditName() {
    setTempName('');
    setIsEditingName(false);
  }

  async function handleSaveName() {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile(user.id, { full_name: tempName });
      setUserData({ ...userData, full_name: tempName });
      setIsEditingName(false);
      setTempName('');
      await showAlert('Profile updated successfully!');
      await refreshUser();
    } catch (error) {
      console.error('Error updating profile:', error);
      await showAlert('Error updating profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUserUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile(user.id, { full_name: userData.full_name });
      await showAlert('Profile updated successfully!');
      await refreshUser();
    } catch (error) {
      console.error('Error updating profile:', error);
      await showAlert('Error updating profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCompanyUpdate(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      await updateCompanySettings({
        company_name: companyData.company_name,
        receipt_header_text: companyData.receipt_header_text,
      });
      await showAlert('Company settings updated successfully!');
    } catch (error) {
      console.error('Error updating company settings:', error);
      await showAlert('Error updating company settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto h-full flex items-center justify-center py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="text-center">
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col py-6 sm:px-6 lg:px-8">
      <div className="px-4 flex flex-col h-full sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 flex-shrink-0">Settings</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6 flex-shrink-0">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('user')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'user'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              User Settings
            </button>
            <button
              onClick={() => setActiveTab('business')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'business'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Business Settings
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'data'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Data Management
            </button>
          </nav>
        </div>

        {/* User Settings Tab */}
        {activeTab === 'user' && (
          <div className="bg-white shadow-sm rounded-xl overflow-hidden flex-1 overflow-y-auto min-h-0">
            <div className="flex flex-col h-full">
              {/* Profile Header Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-8 border-b border-gray-200 flex-shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Profile Photo Display */}
                  <div className="relative">
                    <div className="relative w-24 h-24 rounded-full ring-4 ring-white shadow-lg overflow-hidden bg-gray-100 cursor-pointer hover:ring-blue-400 transition-all group" onClick={handleCameraClick}>
                      {profilePhotoPreview ? (
                        <Image
                          src={profilePhotoPreview}
                          alt="Profile"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-500">
                          <User className="w-12 h-12 text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCameraClick}
                      disabled={saving}
                      className="absolute -bottom-1 -right-1 bg-blue-500 hover:bg-blue-600 rounded-full p-1.5 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Change profile photo"
                    >
                      <Camera className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* Profile Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {isEditingName ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="text-2xl font-bold text-gray-900 bg-white border-2 border-blue-500 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex-1 max-w-md"
                            placeholder="Enter your full name"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveName();
                              } else if (e.key === 'Escape') {
                                handleCancelEditName();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={saving || !tempName.trim()}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Save"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditName}
                            disabled={saving}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Cancel"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h2 className="text-2xl font-bold text-gray-900">
                            {userData.full_name || 'User Profile'}
                          </h2>
                          <button
                            type="button"
                            onClick={handleStartEditName}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit name"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                    {user?.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Mail className="w-4 h-4" />
                        <span>{user.email}</span>
                      </div>
                    )}
                    <p className="text-sm text-gray-600">
                      Manage your personal information and profile settings
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="flex-1 p-8 space-y-8">
                {/* Signature Section */}
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                          <PenTool className="w-4 h-4 text-blue-600" />
                          Signature Preview
                        </label>
                        <p className="text-xs text-gray-600 mb-4">
                          Your signature will appear on stock cards and documents you create
                        </p>
                        {/* Signature Display - Horizontal like on stock cards */}
                        <div className="relative w-full max-w-md">
                          <div className="mb-1 border-b-2 border-gray-900 pb-2 min-h-[50px] flex items-center justify-start cursor-pointer hover:border-blue-500 transition-colors group relative" onClick={handleSignatureClick}>
                            {signaturePreview ? (
                              <img
                                src={signaturePreview}
                                alt="Signature"
                                className="max-w-full max-h-12 object-contain"
                              />
                            ) : (
                              <span className="text-gray-400 text-sm">No signature uploaded</span>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <Upload className="w-5 h-5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleSignatureClick}
                            disabled={saving}
                            className="absolute -bottom-1 -right-1 bg-blue-500 hover:bg-blue-600 rounded-full p-1.5 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Upload or change signature"
                          >
                            <Upload className="w-4 h-4 text-white" />
                          </button>
                          <p className="text-xs font-bold text-gray-900 uppercase tracking-wide mt-1">User Signature</p>
                          <p className="text-xs text-gray-600 mt-0.5">Authorized Signatory</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Image Source Dialogs */}
            <ImageSourceDialog
              isOpen={showProfileSourceDialog}
              onClose={() => setShowProfileSourceDialog(false)}
              onSelectCamera={() => {
                setShowProfileSourceDialog(false);
                setShowProfileCamera(true);
              }}
              onSelectUpload={() => {
                setShowProfileSourceDialog(false);
                handleFileSelect(handleProfilePhotoChange, true);
              }}
              title="Select Profile Photo Source"
            />
            <ImageSourceDialog
              isOpen={showSignatureSourceDialog}
              onClose={() => setShowSignatureSourceDialog(false)}
              onSelectCamera={() => {
                setShowSignatureSourceDialog(false);
                setShowSignatureCamera(true);
              }}
              onSelectUpload={() => {
                setShowSignatureSourceDialog(false);
                handleFileSelect(handleSignatureChange, true);
              }}
              title="Select Signature Source"
            />
            {/* Camera Capture Modals */}
            <CameraCapture
              isOpen={showProfileCamera}
              onClose={() => setShowProfileCamera(false)}
              onCapture={handleProfilePhotoCapture}
              facingMode="user"
              enableCrop={true}
            />
            <CameraCapture
              isOpen={showSignatureCamera}
              onClose={() => setShowSignatureCamera(false)}
              onCapture={handleSignatureCapture}
              facingMode="environment"
              enableCrop={true}
            />
            {/* Image Crop Modals */}
            {profileImageToCrop && (
              <ImageCrop
                image={profileImageToCrop}
                isOpen={!!profileImageToCrop}
                onClose={() => setProfileImageToCrop(null)}
                onCropComplete={handleProfileCropComplete}
              />
            )}
            {signatureImageToCrop && (
              <ImageCrop
                image={signatureImageToCrop}
                isOpen={!!signatureImageToCrop}
                onClose={() => setSignatureImageToCrop(null)}
                onCropComplete={handleSignatureCropComplete}
              />
            )}
          </div>
        )}

        {/* Business Settings Tab */}
        {activeTab === 'business' && (
          <div className="bg-white shadow rounded-lg p-6 flex-1 overflow-y-auto min-h-0">
            {/* <h2 className="text-lg font-semibold text-gray-900 mb-6">Company Settings</h2> */}
            <p className="text-sm text-gray-600 mb-6">
              These settings will be used on stock cards and documents.
            </p>
            <form onSubmit={handleCompanyUpdate} className="space-y-6">
              {/* Company Logo */}
              <ImagePicker
                label="Company Logo"
                value={logoPreview}
                onChange={handleLogoChange}
                size="custom"
                aspectRatio="auto"
                previewClassName="h-16"
                pickerClassName="border-blue-600 hover:border-blue-700"
                disabled={saving}
                accept="image/*"
              />

              {/* Company Name */}
              <div>
                <Input
                  type="text"
                  label="Company Name"
                  value={companyData.company_name}
                  onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                />
              </div>

              {/* Receipt Header Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Card Header Text
                </label>
                <textarea
                  value={companyData.receipt_header_text}
                  onChange={(e) => setCompanyData({ ...companyData, receipt_header_text: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  rows={3}
                  placeholder="Text to display on stock card headers"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This text will appear as the heading on stock cards. Use line breaks (Enter) to create multiple lines.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-200">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={saving}
                  disabled={saving}
                >
                  Update Company Settings
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Data Management Tab */}
        {activeTab === 'data' && (
          <div className="space-y-6 flex-1 overflow-y-auto min-h-0">
            <p className="text-gray-600 mb-6">
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
                onClick={async () => {
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
                }}
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
                onClick={async () => {
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
                }}
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
                onClick={async () => {
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
                }}
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
                onClick={async () => {
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
                }}
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
        )}
      </div>
    </div>
  );
}
