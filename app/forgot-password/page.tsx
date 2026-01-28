'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { generatePasswordResetToken, getAllUserEmails } from '@/lib/auth';
import { Input, Button, useDialog } from '@/components/ui';
import { useTexts } from '@/hooks/useTexts';
import { Copy, Check } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useTexts();
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [availableEmails, setAvailableEmails] = useState<string[]>([]);

  useEffect(() => {
    async function loadEmails() {
      try {
        const emails = await getAllUserEmails();
        setAvailableEmails(emails);
        // Auto-fill if there's exactly one account
        if (emails.length === 1) {
          setEmail(emails[0]);
        }
      } catch (error) {
        console.error('Error loading emails:', error);
        // Silently fail - user can still enter email manually
      }
    }
    loadEmails();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      await showAlert(t('forgotPassword.emailRequired', 'Please enter your email address.'));
      return;
    }

    try {
      setLoading(true);
      const token = await generatePasswordResetToken(email);
      setResetToken((token ?? '').trim());
      await showAlert(t('forgotPassword.tokenGenerated', 'Password reset token generated successfully! Copy the token below and use it to reset your password.'));
    } catch (error) {
      console.error('Error generating reset token:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(`${t('forgotPassword.generateError', 'Error generating reset token')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (resetToken) {
      try {
        await navigator.clipboard.writeText(resetToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  }

  if (resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {t('forgotPassword.tokenGeneratedTitle', 'Reset Token Generated')}
            </h1>
            <p className="text-sm text-gray-600 text-center">
              {t('forgotPassword.copyTokenHint', 'Copy this token and use it to reset your password')}
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              {t('forgotPassword.resetToken', 'Reset Token')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={resetToken}
                readOnly
                className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 bg-gray-50 text-gray-900 font-mono pr-12"
              />
              <button
                onClick={copyToClipboard}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Copy token"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
            {copied && (
              <p className="mt-2 text-xs text-green-600">Token copied to clipboard!</p>
            )}
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => router.push(`/reset-password?token=${encodeURIComponent(resetToken)}`)}
              variant="primary"
              fullWidth
            >
              {t('forgotPassword.continueToReset', 'Continue to Reset Password')}
            </Button>
            <Button
              onClick={() => {
                setResetToken(null);
                setEmail('');
              }}
              variant="outline"
              fullWidth
            >
              {t('forgotPassword.generateNew', 'Generate New Token')}
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              {t('forgotPassword.backToLogin', 'Back to Login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            {t('forgotPassword.title', 'Forgot Password')}
          </h1>
          <p className="text-sm text-gray-600 text-center">
            {t('forgotPassword.desc', 'Enter your email to receive a password reset token')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {availableEmails.length > 1 && (
            <div className="mb-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('forgotPassword.selectAccount', 'Select Account')} ({availableEmails.length} {t('forgotPassword.accountsFound', 'accounts found')})
              </label>
              <select
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">{t('forgotPassword.selectEmail', 'Select an email...')}</option>
                {availableEmails.map((emailOption) => (
                  <option key={emailOption} value={emailOption}>
                    {emailOption}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Input
            type="email"
            label={t('auth.email', 'Email')}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('forgotPassword.enterEmailPlaceholder', 'Enter your email address')}
            disabled={availableEmails.length === 1}
          />
          {availableEmails.length === 1 && (
            <p className="text-xs text-gray-500 -mt-2">
              {t('forgotPassword.autoFilledHint', 'Auto-filled from existing account')}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={loading}
            disabled={loading}
          >
            {t('forgotPassword.generateButton', 'Generate Reset Token')}
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
            {t('forgotPassword.backToLogin', 'Back to Login')}
          </Link>
        </div>
      </div>
    </div>
  );
}
