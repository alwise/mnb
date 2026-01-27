'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, setCurrentUser } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Input, Button, useDialog } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { showAlert } = useDialog();
  const { login: setAuthUser, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      await showAlert('Please fill in all fields.');
      return;
    }

    try {
      setLoading(true);
      const user = await login(formData.email, formData.password);
      if (user) {
        setCurrentUser(user.id);
        setAuthUser(user);
        await showAlert('Login successful! Redirecting...');
        router.push('/dashboard');
      } else {
        await showAlert('Invalid email or password.');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showAlert(`Error logging in: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 md:p-10 border border-gray-200">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            Sign In
          </h1>
          <p className="text-sm text-gray-600 text-center">
            Enter your credentials to access your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={loading}
            disabled={loading}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Forgot your password?
            </Link>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
