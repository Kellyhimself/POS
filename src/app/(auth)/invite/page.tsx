"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import Link from 'next/link';

interface Invitation {
  id: string;
  email: string;
  role: string;
  store_id: string;
  stores: {
    name: string;
  };
}

export default function InvitePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp } = useSimplifiedAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid invitation link');
      return;
    }

    // Fetch invitation details
    fetch(`/api/invitations?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvitation(data);
          setEmail(data.email);
        }
      })
      .catch(err => {
        setError('Failed to load invitation');
      });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signUp(email, password, invitation.role, invitation.store_id);
      if (error) throw error;

      router.push('/dashboard');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!invitation && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0ABAB5] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-sm">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600">Invalid Invitation</h2>
            <p className="mt-2 text-gray-600">{error}</p>
            <Link href="/login" className="mt-4 inline-block text-[#0ABAB5] hover:text-[#099C98]">
              Return to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-sm">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">Join {invitation.stores.name}</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You've been invited as a {invitation.role}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

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
                disabled
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0ABAB5] focus:border-[#0ABAB5]"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0ABAB5] hover:bg-[#099C98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0ABAB5] disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 