'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword, validatePasswordResetToken } from '@/lib/auth';
import { Input, Button, useDialog } from '@/components/ui';
import { useTexts } from '@/hooks/useTexts';

function trimToken(s: string | null): string {
  return (s ?? '').trim();
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTexts();
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  /** Token to use for reset: from URL or from pasted field */
  const [effectiveToken, setEffectiveToken] = useState<string | null>(null);
  const [pastedToken, setPastedToken] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // When URL has a token, validate it and keep it for the form
  useEffect(() => {
    let cancelled = false;
    const tokenFromUrl = trimToken(searchParams.get('token'));

    if (!tokenFromUrl) {
      setValidating(false);
      return;
    }

    async function run() {
      try {
        const userId = await validatePasswordResetToken(tokenFromUrl);
        if (cancelled) return;
        if (userId) {
          setEffectiveToken(tokenFromUrl);
          setTokenValid(true);
        } else {
          await showAlert(t('resetPassword.invalidToken', 'Invalid or expired reset token. Please request a new password reset.'));
          if (!cancelled) router.replace('/forgot-password');
        }
      } catch (error) {
        console.error('Error validating token:', error);
        if (!cancelled) {
          await showAlert(t('resetPassword.validateError', 'Error validating reset token. Please request a new password reset.'));
          router.replace('/forgot-password');
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router, showAlert, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.password || !formData.confirmPassword) {
      await showAlert(t('resetPassword.fillAllFields', 'Please fill in all fields.'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      await showAlert(t('resetPassword.passwordsDoNotMatch', 'Passwords do not match.'));
      return;
    }

    if (formData.password.length < 6) {
      await showAlert(t('resetPassword.passwordTooShort', 'Password must be at least 6 characters long.'));
      return;
    }

    const token = effectiveToken ?? trimToken(searchParams.get('token'));
    if (!token) {
      await showAlert(t('resetPassword.tokenMissing', 'Reset token is missing.'));
      return;
    }

    try {
      setLoading(true);
      await resetPassword(token, formData.password);
      await showAlert(t('resetPassword.resetSuccess', 'Password reset successfully! Redirecting to login...'));
      router.push('/login');
    } catch (error) {
      console.error('Error resetting password:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(`${t('resetPassword.resetError', 'Error resetting password')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  // URL had a token and we're still validating
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200">
          <div className="text-center">
            <p className="text-gray-600">{t('resetPassword.validating', 'Validating reset token...')}</p>
          </div>
        </div>
      </div>
    );
  }

  // No token in URL and not yet validated via paste: show "Paste your token" so the copied token is used
  const urlToken = trimToken(searchParams.get('token'));
  if (!tokenValid && !urlToken) {
    async function handlePasteSubmit(e: React.FormEvent) {
      e.preventDefault();
      const tkn = trimToken(pastedToken);
      if (!tkn) {
        await showAlert(t('resetPassword.noToken', 'No reset token provided. Please request a new password reset.'));
        return;
      }
      setLoading(true);
      try {
        const userId = await validatePasswordResetToken(tkn);
        if (userId) {
          setEffectiveToken(tkn);
          setTokenValid(true);
        } else {
          await showAlert(t('resetPassword.invalidToken', 'Invalid or expired reset token. Please request a new password reset.'));
        }
      } catch (err) {
        console.error('Error validating token:', err);
        await showAlert(t('resetPassword.validateError', 'Error validating reset token. Please request a new password reset.'));
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {t('resetPassword.title', 'Reset Password')}
            </h1>
            <p className="text-sm text-gray-600 text-center">
              {t('resetPassword.pasteTokenHint', 'Paste the reset token you copied from the previous step')}
            </p>
          </div>
          <form onSubmit={handlePasteSubmit} className="space-y-4">
            <Input
              type="text"
              label={t('resetPassword.tokenLabel', 'Reset token')}
              value={pastedToken}
              onChange={(e) => setPastedToken(e.target.value)}
              placeholder={t('resetPassword.pasteTokenPlaceholder', 'Paste your token here')}
              autoComplete="one-time-code"
            />
            <Button type="submit" variant="primary" fullWidth isLoading={loading} disabled={loading}>
              {t('resetPassword.continueWithToken', 'Continue with token')}
            </Button>
          </form>
          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              {t('resetPassword.requestNewToken', 'Request a new token')}
            </Link>
            <span className="text-gray-400 mx-1">|</span>
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              {t('resetPassword.backToLogin', 'Back to Login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            {t('resetPassword.title', 'Reset Password')}
          </h1>
          <p className="text-sm text-gray-600 text-center">
            {t('resetPassword.desc', 'Enter your new password')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label={t('resetPassword.newPassword', 'New Password')}
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            helperText={t('resetPassword.passwordHint', 'Must be at least 6 characters long')}
          />

          <Input
            type="password"
            label={t('resetPassword.confirmNewPassword', 'Confirm New Password')}
            required
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={loading}
            disabled={loading}
          >
            {t('resetPassword.title', 'Reset Password')}
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
            {t('resetPassword.backToLogin', 'Back to Login')}
          </Link>
        </div>
      </div>
    </div>
  );
}
