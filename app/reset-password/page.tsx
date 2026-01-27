'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword, validatePasswordResetToken } from '@/lib/auth';
import { Input, Button, useDialog } from '@/components/ui';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    async function validateToken() {
      const token = searchParams.get('token');
      if (!token) {
        await showAlert('No reset token provided. Please request a new password reset.');
        router.push('/forgot-password');
        return;
      }

      try {
        const userId = await validatePasswordResetToken(token);
        if (userId) {
          setTokenValid(true);
        } else {
          await showAlert('Invalid or expired reset token. Please request a new password reset.');
          router.push('/forgot-password');
        }
      } catch (error) {
        console.error('Error validating token:', error);
        await showAlert('Error validating reset token. Please request a new password reset.');
        router.push('/forgot-password');
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [searchParams, router, showAlert]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.password || !formData.confirmPassword) {
      await showAlert('Please fill in all fields.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      await showAlert('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      await showAlert('Password must be at least 6 characters long.');
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      await showAlert('Reset token is missing.');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(token, formData.password);
      await showAlert('Password reset successfully! Redirecting to login...');
      router.push('/login');
    } catch (error) {
      console.error('Error resetting password:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(`Error resetting password: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200">
          <div className="text-center">
            <p className="text-gray-600">Validating reset token...</p>
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
            Reset Password
          </h1>
          <p className="text-sm text-gray-600 text-center">
            Enter your new password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="New Password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            helperText="Must be at least 6 characters long"
          />

          <Input
            type="password"
            label="Confirm New Password"
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
            Reset Password
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
