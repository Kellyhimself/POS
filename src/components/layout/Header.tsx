"use client";

import { useState, useEffect, useRef } from 'react';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { useRouter } from 'next/navigation';
import { ModeIndicator } from '@/components/ui/ModeIndicator';

interface HeaderProps {
  isOnline: boolean;
  storeName?: string;
}

const Header = ({ isOnline, storeName }: HeaderProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const { user, signOut, mode } = useSimplifiedAuth();
  const { clearOfflineData } = useUnifiedService();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Try to get first name from user metadata, fallback to email or 'User'
  const firstName = user?.user_metadata?.first_name || user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';
  const avatarLetter = firstName.charAt(0).toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isProfileOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  const handleSignOut = async () => {
    setIsProfileOpen(false);
    console.log('🔐 Header: Starting sign out process');
    console.log(`🌐 Header: Current mode - ${mode}`);
    
    try {
      await signOut();
      console.log('✅ Header: Sign out successful');
    } catch (error) {
      console.error('❌ Header: Sign out error:', error);
    }
  };

  const handleClearOfflineData = async () => {
    try {
      await clearOfflineData();
      setIsConfirmingClear(false);
      setIsProfileOpen(false);
      // Optionally refresh the page or show a success message
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      // Optionally show an error message
    }
  };

  return (
    <>
      <header className="bg-gradient-to-r from-[#1A1F36] via-[#2D3748] to-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Store name */}
            <div className="hidden md:flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-white">
                {storeName || 'Store Management'}
              </h1>
            </div>

            {/* Right side - Mode indicator and User profile */}
            <div className="flex items-center justify-end w-full md:w-auto gap-4">
              {/* Mode Indicator - Only show on md and up */}
              <div className="hidden md:block">
                <ModeIndicator />
              </div>
              
              {/* Profile toggle and avatar */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none rounded-full bg-white/10"
                >
                  <div className="w-8 h-8 bg-[#0ABAB5] text-white rounded-full flex items-center justify-center text-base font-medium">
                    {avatarLetter}
                  </div>
                  <span className="hidden md:inline text-white mr-2">{firstName}</span>
                </button>

                {/* Profile dropdown */}
                {isProfileOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200"
                  >
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      <div className="font-medium break-words">{user?.email}</div>
                      <div className="text-gray-500">{user?.user_metadata?.role || 'User'}</div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Clear offline data confirmation */}
      {isConfirmingClear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Clear Offline Data
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This will clear all offline data including products, transactions, and settings. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleClearOfflineData}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header; 