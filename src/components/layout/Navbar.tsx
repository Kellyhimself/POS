"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { syncService } from '@/lib/sync';
import { cn } from '@/lib/utils';
import { OfflineSignOutPrompt } from '../auth/OfflineSignOutPrompt';

interface NavbarProps {
  isOnline: boolean;
  storeName?: string;
}

const Navbar = ({ isOnline, storeName }: NavbarProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isSignOutPromptOpen, setIsSignOutPromptOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Listen for sidebar state changes
  useEffect(() => {
    const handleStorageChange = () => {
      const preference = localStorage.getItem('sidebarPreference');
      setSidebarOpen(preference === 'open');
    };

    // Initial check
    handleStorageChange();

    // Listen for changes from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Listen for changes from the current window
    const handleCustomEvent = (e: CustomEvent) => {
      setSidebarOpen(e.detail === 'open');
    };
    window.addEventListener('sidebarChange', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarChange', handleCustomEvent as EventListener);
    };
  }, []);

  // Try to get first name from user metadata, fallback to email or 'User'
  const firstName = user?.user_metadata?.first_name || user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';
  const avatarLetter = firstName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setIsProfileOpen(false);
    if (!isOnline) {
      setIsSignOutPromptOpen(true);
    } else {
      await signOut();
      router.push('/login');
    }
  };

  const handleSignOutConfirm = async (password: string) => {
    setIsSignOutPromptOpen(false);
    await signOut(password);
    router.push('/login');
  };

  const handleClearOfflineData = async () => {
    try {
      await syncService.clearOfflineData();
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
      <div className={cn(
        "fixed top-0 right-0 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between z-50 transition-all duration-300",
        sidebarOpen ? "left-64" : "left-20"
      )}>
        <div className="flex items-center">
          <h2 className="text-lg font-medium text-gray-800">{storeName || 'Loading...'}</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 ${
            isOnline ? 'text-green-600' : 'text-red-600'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-600' : 'bg-red-600'
            }`}></div>
            <span className="text-sm font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          
          {/* Notifications */}
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <span className="text-gray-600">🔔</span>
          </button>
          
          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#0ABAB5] flex items-center justify-center text-white font-medium">
                {avatarLetter}
              </div>
            </button>
            
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2">
                <a href="/profile" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                  Profile
                </a>
                <a href="/settings" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                  Settings
                </a>
                <hr className="my-2 border-gray-200" />
                <button
                  onClick={() => setIsConfirmingClear(true)}
                  className="block w-full text-left px-4 py-2 text-yellow-600 hover:bg-gray-50"
                >
                  Clear Offline Data
                </button>
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {isConfirmingClear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Clear Offline Data
            </h3>
            <p className="text-gray-600 mb-6">
              This will delete all offline data including pending sales, stock updates, and ETIMS submissions. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleClearOfflineData}
                className="px-4 py-2 bg-yellow-600 text-white hover:bg-yellow-700 rounded-md"
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Sign Out Prompt */}
      <OfflineSignOutPrompt
        isOpen={isSignOutPromptOpen}
        onClose={() => setIsSignOutPromptOpen(false)}
        onConfirm={handleSignOutConfirm}
      />
    </>
  );
};

export default Navbar; 