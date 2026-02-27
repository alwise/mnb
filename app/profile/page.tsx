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
import { Input, Button, ImagePicker, useDialog, Textarea, ScrollView } from '@/components/ui';
import CameraCapture from '@/components/ui/CameraCapture';
import ImageSourceDialog from '@/components/ui/ImageSourceDialog';
import ImageCrop from '@/components/ui/ImageCrop';
import { User, PenTool, Save, Edit2, Check, X, Mail, Camera, Upload, MapPin, Phone, Globe, Building2, Layout, FileText } from 'lucide-react';
import {
  createBackupMyData,
  createBackupAll,
  restoreBackup,
  deleteAccount,
  resetAllData,
} from '@/lib/data-management';
import { useTexts } from '@/hooks/useTexts';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryKeys';

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useTexts();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm } = useDialog();
  const { user, refreshUser, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'user' | 'business' | 'data'>('user');
  const [backingUpType, setBackingUpType] = useState<'my-data' | 'all' | null>(null);
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
    address: '',
    phone: '',
    email: '',
    website: '',
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
          company_name: settings.company_name || '',
          receipt_header_text: settings.receipt_header_text || '',
          address: settings.address || '',
          phone: settings.phone || '',
          email: settings.email || '',
          website: settings.website || '',
        });

        const logo = await getCompanyLogoDataUrl();
        if (logo) setLogoPreview(logo);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      await showAlert(t('profile.loadError', 'Error loading profile data. Make sure you are running in Tauri environment.'));
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
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.settings.companyLogo(user.id) });
      }
      await showAlert(t('profile.updateSuccess'));
    } catch (error) {
      console.error('Error uploading logo:', error);
      await showAlert(t('profile.updateError'));
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
      await showAlert(t('profile.updateSuccess'));
      await refreshUser();
    } catch (error) {
      console.error('Error updating profile:', error);
      await showAlert(t('profile.updateError'));
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
      await showAlert(t('profile.updateSuccess'));
      await refreshUser();
    } catch (error) {
      console.error('Error updating profile:', error);
      await showAlert(t('profile.updateError'));
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
        address: companyData.address,
        phone: companyData.phone,
        email: companyData.email,
        website: companyData.website,
      });
      await showAlert(t('profile.updateSuccess', 'Company settings updated successfully!'));
    } catch (error) {
      console.error('Error updating company settings:', error);
      await showAlert(t('profile.updateError', 'Error updating company settings.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto h-full flex items-center justify-center py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="text-center">
            <p className="text-gray-600">{t('profile.loadingProfile')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col py-6 sm:px-6 lg:px-8">
      <div className="px-4 flex flex-col sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 flex-shrink-0">{t('profile.title')}</h1>

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
              {t('profile.userSettings')}
            </button>
            <button
              onClick={() => setActiveTab('business')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'business'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {t('profile.businessSettings')}
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'data'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {t('profile.dataManagement')}
            </button>
          </nav>
        </div>

        {/* User Settings Tab */}
        {activeTab === 'user' && (
          <ScrollView className="bg-white shadow-sm rounded-xl flex-1 border border-gray-100">
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
                      title={t('profile.changePhoto')}
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
                            placeholder={t('profile.enterFullName')}
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
                            {userData.full_name || t('profile.userProfile')}
                          </h2>
                          <button
                            type="button"
                            onClick={handleStartEditName}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('profile.editName')}
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
                      {t('profile.personalInfoDesc')}
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
                          {t('profile.signaturePreview')}
                        </label>
                        <p className="text-xs text-gray-600 mb-4">
                          {t('profile.signatureHint')}
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
                              <span className="text-gray-400 text-sm">{t('profile.noSignature')}</span>
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
                          <p className="text-xs font-bold text-gray-900 uppercase tracking-wide mt-1">{t('receipts.userSignature')}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{t('receipts.authorizedSignatory')}</p>
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
          </ScrollView>
        )}

        {/* Business Settings Tab */}
        {activeTab === 'business' && (
          <ScrollView className="bg-white shadow-sm rounded-xl flex-1 border border-gray-100">
            <form onSubmit={handleCompanyUpdate} className="p-8 space-y-8">
              {/* Brand Identity Section */}
              <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-xl p-6 border border-blue-100/50">
                <div className="flex items-center gap-2 mb-6">
                  <div className="bg-blue-600 rounded-lg p-1.5">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('profile.companyIdentity')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
                  <div className="md:col-span-1">
                    <ImagePicker
                      label={<span className="text-xs font-bold text-blue-600 uppercase tracking-tight">{t('profile.orgLogo')}</span>}
                      value={logoPreview}
                      onChange={handleLogoChange}
                      size="custom"
                      aspectRatio="auto"
                      previewClassName="h-32 rounded-xl bg-white shadow-inner"
                      pickerClassName="border-blue-200 hover:border-blue-400 shadow-sm transition-all bg-white/50"
                      disabled={saving}
                      accept="image/*"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-4">
                    <Input
                      type="text"
                      label={
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-500" />
                          <span>{t('profile.companyLegalName')}</span>
                        </div>
                      }
                      value={companyData.company_name}
                      onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                      className="text-lg font-semibold bg-white ring-offset-blue-50"
                      placeholder={t('profile.companyNamePlaceholder')}
                    />
                    <div className="flex gap-2">
                      <div className="h-1.5 w-1 bg-blue-500 rounded-full"></div>
                      <p className="text-xs text-gray-500 leading-relaxed font-medium">
                        {t('profile.identityDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Channels Section */}
              <div className="space-y-6 px-1">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('profile.contactInfo')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Input
                    type="text"
                    label={
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-blue-500/60" />
                        <span>{t('profile.phone')}</span>
                      </div>
                    }
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    placeholder="+233 ..."
                  />

                  <Input
                    type="email"
                    label={
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-500/60" />
                        <span>{t('profile.officialEmail')}</span>
                      </div>
                    }
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    placeholder="office@company.com"
                  />

                  <Input
                    type="text"
                    label={
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500/60" />
                        <span>{t('profile.website')}</span>
                      </div>
                    }
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                    placeholder="www.company.com"
                  />
                </div>
              </div>

              {/* Operations & Headers Section */}
              <div className="space-y-6 px-1 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Layout className="w-5 h-5 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('profile.operationalSettings')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Textarea
                    label={
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-500/60" />
                        <span>{t('profile.address')}</span>
                      </div>
                    }
                    value={companyData.address}
                    onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                    rows={2}
                    placeholder={t('profile.addressPlaceholder')}
                    className="min-h-[100px] resize-none"
                  />

                  <Textarea
                    label={
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500/60" />
                        <span>{t('profile.stockCardHeader')}</span>
                      </div>
                    }
                    helperText={t('profile.headerHint')}
                    value={companyData.receipt_header_text}
                    onChange={(e) => setCompanyData({ ...companyData, receipt_header_text: e.target.value })}
                    rows={2}
                    placeholder={t('profile.headerPlaceholder')}
                    className="min-h-[100px] resize-none"
                  />
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-8 border-t border-gray-200">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={saving}
                  disabled={saving}
                  className="w-full sm:w-auto min-w-[220px] shadow-xl shadow-blue-500/20 py-4"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {t('profile.saveBusiness')}
                </Button>
              </div>
            </form>
          </ScrollView>
        )}

        {/* Data Management Tab */}
        {activeTab === 'data' && (
          <ScrollView className="space-y-6 flex-1">
            <div className="space-y-6">
              <p className="text-gray-600 mb-6 font-medium">
                {t('profile.dataMgmtDesc')}
              </p>

              {/* Backup Section */}
              <div className="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-blue-500">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('profile.backupTitle')}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {t('profile.backupDesc')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={async () => {
                      try {
                        setBackingUpType('my-data');
                        const filePath = await createBackupMyData();
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
                        setBackingUpType(null);
                      }
                    }}
                    variant="primary"
                    isLoading={backingUpType === 'my-data'}
                    disabled={!!backingUpType}
                  >
                    {backingUpType === 'my-data' ? t('profile.creatingBackup') : t('profile.backupMyData')}
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        setBackingUpType('all');
                        const filePath = await createBackupAll();
                        await showAlert(
                          `Backup created successfully!\n\nSaved to: ${filePath}\n\nThis ZIP contains backups for all user accounts, each file named by email address.`,
                          'Backup Successful'
                        );
                      } catch (error) {
                        console.error('Error creating backup:', error);
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        await showAlert(
                          `Error creating backup: ${errorMessage}\n\nMake sure you are running the app in Tauri environment.`,
                          'Backup Failed'
                        );
                      } finally {
                        setBackingUpType(null);
                      }
                    }}
                    variant="secondary"
                    isLoading={backingUpType === 'all'}
                    disabled={!!backingUpType}
                  >
                    {backingUpType === 'all' ? t('profile.creatingBackup') : t('profile.backupAll')}
                  </Button>
                </div>
              </div>

              {/* Restore Section */}
              <div className="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-green-500">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('profile.restoreTitle')}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {t('profile.restoreDesc')}
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
                  {restoring ? t('common.loading') : t('profile.restoreTitle')}
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
          </ScrollView>
        )}
      </div>
    </div>
  );
}
