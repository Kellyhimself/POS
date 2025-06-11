"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import { AuthError } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { WifiOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, session, isOnline } = useAuth();
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('offline')) {
          setError('Please login while online first to enable offline access.');
        } else {
          setError(error.message);
        }
        return;
      }
      
      if (data?.session) {
        // Wait a moment to ensure the session is set
        await new Promise(resolve => setTimeout(resolve, 1000));
        router.push('/');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof AuthError) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-sm">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-center text-sm text-gray-700">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-[#0ABAB5] hover:text-[#099C98]">
              Sign up
            </Link>
          </p>
        </div>

        {!isOnline && (
          <div className="flex items-center justify-center text-yellow-600 bg-yellow-50 p-3 rounded-md">
            <WifiOff className="h-5 w-5 mr-2" />
            <span className="text-sm">You&apos;re offline. Please enter your credentials to sign in.</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#0ABAB5] hover:bg-[#099C98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0ABAB5]'
            }`}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
} 