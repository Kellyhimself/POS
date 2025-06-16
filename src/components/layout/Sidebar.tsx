"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, Menu, RefreshCw, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PendingSubmissions } from '@/components/etims/PendingSubmissions';
import SyncQRCode from '@/components/etims/SyncQRCode';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Check if user has a preference stored
  useEffect(() => {
    const savedPreference = localStorage.getItem('sidebarPreference');
    if (savedPreference) {
      setIsOpen(savedPreference === 'open');
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setIsOpen(false);
      } else {
        // Restore user preference on desktop
        const savedPreference = localStorage.getItem('sidebarPreference');
        if (savedPreference) {
          setIsOpen(savedPreference === 'open');
        } else {
          setIsOpen(true);
        }
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save user preference
  const toggleSidebar = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    localStorage.setItem('sidebarPreference', newState ? 'open' : 'closed');
    // Dispatch custom event for the layout to listen to
    window.dispatchEvent(new CustomEvent('sidebarChange', { detail: newState ? 'open' : 'closed' }));
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (!user) return null;

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'POS', href: '/pos', icon: '💳' },
    { name: 'Inventory', href: '/inventory', icon: '📦' },
    { name: 'Reports', href: '/reports', icon: '📈' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
    { name: 'Bulk Operations', href: '/bulk-operations', icon: '🗂️' },
  ];

  const SidebarContent = () => (
    <>
      <div className="px-6 mb-8 flex items-center justify-between">
        <h1 className={cn(
          "text-xl font-bold text-white transition-all duration-300",
          !isOpen && "opacity-0 w-0"
        )}>
          POS System
        </h1>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={toggleSidebar}
          >
            {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
      </div>
      
      <nav className="px-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center px-4 py-3 text-sm rounded-lg transition-colors relative",
              pathname === item.href 
                ? 'bg-[#0ABAB5] text-white' 
                : 'text-gray-300 hover:bg-[#2D3748] hover:text-white',
              !isOpen && "justify-center"
            )}
          >
            <span className={cn(
              "transition-all duration-300",
              !isOpen && "mr-0"
            )}>{item.icon}</span>
            <span className={cn(
              "transition-all duration-300",
              !isOpen && "opacity-0 w-0"
            )}>
              {item.name}
            </span>
            {/* Tooltip for collapsed state */}
            {!isOpen && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#2D3748] text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {item.name}
              </div>
            )}
          </Link>
        ))}
      </nav>
    </>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile menu button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-[#1A1F36] text-white"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Sidebar */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-64 bg-[#1A1F36] text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex flex-col h-full">
            {/* Store Info */}
            <div className="p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">{user.user_metadata?.store_name || 'Store'}</h2>
              <p className="text-sm text-gray-400">{user.user_metadata?.store_location || 'Location'}</p>
            </div>

            {/* Sync Section */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {user?.user_metadata?.store_id && (
                <>
                  <SyncQRCode storeId={user.user_metadata.store_id} />
                  <PendingSubmissions storeId={user.user_metadata.store_id} />
                </>
              )}
            </div>

            {/* User Section */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-gray-400">Admin</p>
                </div>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className={cn(
      "bg-[#1A1F36] text-white h-screen fixed left-0 top-0 pt-20 transition-all duration-300",
      isOpen ? "w-64" : "w-20"
    )}>
      <SidebarContent />
    </div>
  );
};

export default Sidebar; 