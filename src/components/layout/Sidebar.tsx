"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const Sidebar = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-[#1A1F36] border-none">
          <SidebarContent />
        </SheetContent>
      </Sheet>
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