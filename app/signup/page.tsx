/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signup, setCurrentUser } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Input, Button, FileInput, useDialog } from '@/components/ui';

export default function SignupPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Clear any stale session on mount
  useEffect(() => {
    const userId = localStorage.getItem('current_user_id');
    if (userId && !user) {
      // Clear stale session if user is not logged in
      localStorage.removeItem('current_user_id');
    }
  }, [user]);

  function handleSignatureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.fullName) {
      await showAlert('Please fill in all required fields.');
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

    if (!signatureFile) {
      await showAlert('Please upload your signature. This is required for creating stock cards.');
      return;
    }

    try {
      setLoading(true);
      const userId = await signup(
        formData.email,
        formData.password,
        formData.fullName,
        signatureFile
      );
      setCurrentUser(userId);
      await showAlert('Account created successfully! Redirecting to dashboard...');
      router.push('/dashboard');
    } catch (error) {
      console.error('Signup error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(`Error creating account: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-gray-200">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">
            Create Account
          </h1>
          <p className="text-xs text-gray-600 text-center">
            Sign up to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            label="Full Name"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />

          <Input
            type="email"
            label="Email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            type="password"
            label="Password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />

          <Input
            type="password"
            label="Confirm Password"
            required
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          />

          <div>
            {signaturePreview && (
              <div className="mb-3 border-2 border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-600 mb-1.5">Preview:</p>
                <img
                  src={signaturePreview}
                  alt="Signature preview"
                  className="max-h-24 mx-auto object-contain rounded"
                />
              </div>
            )}
            <FileInput
              accept="image/*"
              label="Signature"
              helperText="Required for creating stock cards"
              onChange={handleSignatureChange}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={loading}
            disabled={loading}
          >
            Create Account
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
