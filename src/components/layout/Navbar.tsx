"use client";

import { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';

interface NavbarProps {
  isOnline: boolean;
  storeName?: string;
}

const Navbar = ({ isOnline, storeName }: NavbarProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Try to get first name from user metadata, fallback to email or 'User'
  const firstName = user?.user_metadata?.first_name || user?.user_metadata?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';
  const avatarLetter = firstName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="fixed top-0 right-0 left-64 h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between z-50">
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
  );
};

export default Navbar; 