"use client";

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [kraToken, setKraToken] = useState('');
  const [etimsUsername, setEtimsUsername] = useState('');
  const [etimsPassword, setEtimsPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let createdStoreId: string | null = null;

    try {
      console.log('Creating store...');
      // First, create the store
      const storeResponse = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: storeName,
          address: storeAddress,
          kra_pin: kraPin || undefined,
          vat_number: vatNumber || undefined,
          kra_token: kraToken || undefined,
          etims_username: etimsUsername || undefined,
          etims_password: etimsPassword || undefined,
        }),
      });

      if (!storeResponse.ok) {
        const errorData = await storeResponse.json();
        console.error('Store creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create store');
      }

      const storeData = await storeResponse.json();
      console.log('Store created:', storeData);
      
      if (!storeData.store_id) {
        console.error('No store_id in response:', storeData);
        throw new Error('Store creation response missing store_id');
      }

      createdStoreId = storeData.store_id;

      console.log('Creating user account...');
      // Then, create the user account
      const { data, error } = await signUp(email, password, 'admin', storeData.store_id);
      
      if (error) {
        console.error('User creation failed:', error);
        throw error;
      }

      if (!data?.user) {
        console.error('No user data returned');
        throw new Error('Failed to create user account');
      }

      console.log('Signup successful');
    } catch (error: unknown) {
      console.error('Signup error:', error);
      // Cleanup: If we created a store but user creation failed, delete the store
      if (createdStoreId) {
        try {
          console.log('Cleaning up store:', createdStoreId);
          await fetch(`/api/stores/${createdStoreId}`, {
            method: 'DELETE',
          });
        } catch (cleanupError) {
          console.error('Failed to cleanup store after error:', cleanupError);
        }
      }
      setError(error instanceof Error ? error.message : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-sm">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">Create your account</h2>
          <p className="mt-2 text-center text-sm text-gray-700">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[#0ABAB5] hover:text-[#099C98]">
              Sign in
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-800">
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0ABAB5] focus:border-[#0ABAB5] text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-800">
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0ABAB5] focus:border-[#0ABAB5] text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="storeName" className="block text-sm font-medium text-gray-800">
                Store Name
              </label>
              <input
                id="storeName"
                name="storeName"
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0ABAB5] focus:border-[#0ABAB5] text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="storeAddress" className="block text-sm font-medium text-gray-800">
                Store Address
              </label>
              <textarea
                id="storeAddress"
                name="storeAddress"
                required
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0ABAB5] focus:border-[#0ABAB5] text-gray-900"
              />
            </div>

            <div>
              <label htmlFor="kraPin" className="block text-sm font-medium text-gray-800">
                KRA PIN (optional)
              </label>
              <input
                id="kraPin"
                name="kraPin"
                type="text"
                value={kraPin}
                onChange={(e) => setKraPin(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="Enter KRA PIN (if VAT registered)"
              />
            </div>

            <div>
              <label htmlFor="vatNumber" className="block text-sm font-medium text-gray-800">
                VAT Number (optional)
              </label>
              <input
                id="vatNumber"
                name="vatNumber"
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="Enter VAT Number (if applicable)"
              />
            </div>

            <div>
              <label htmlFor="kraToken" className="block text-sm font-medium text-gray-800">
                eTIMS API Token (optional)
              </label>
              <input
                id="kraToken"
                name="kraToken"
                type="text"
                value={kraToken}
                onChange={(e) => setKraToken(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="Enter eTIMS API Token (if provided by KRA)"
              />
            </div>

            <div>
              <label htmlFor="etimsUsername" className="block text-sm font-medium text-gray-800">
                eTIMS Username (optional)
              </label>
              <input
                id="etimsUsername"
                name="etimsUsername"
                type="text"
                value={etimsUsername}
                onChange={(e) => setEtimsUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="Enter eTIMS Username (if required)"
              />
            </div>

            <div>
              <label htmlFor="etimsPassword" className="block text-sm font-medium text-gray-800">
                eTIMS Password (optional)
              </label>
              <input
                id="etimsPassword"
                name="etimsPassword"
                type="password"
                value={etimsPassword}
                onChange={(e) => setEtimsPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="Enter eTIMS Password (if required)"
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