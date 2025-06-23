"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import { useRouter } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  requiredRoles?: string[];
}

const navigationItems: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: '📊',
    requiredRoles: ['admin', 'manager', 'accountant', 'owner']
  },
  { name: 'POS', href: '/pos', icon: '💳' },
  { 
    name: 'Inventory', 
    href: '/inventory', 
    icon: '📦',
    requiredRoles: ['admin', 'manager', 'accountant', 'owner']
  },
  { 
    name: 'Purchases', 
    href: '/purchases', 
    icon: '🧾',
    requiredRoles: ['admin', 'manager', 'accountant', 'owner']
  },
  { 
    name: 'Reports', 
    href: '/reports', 
    icon: '📈',
    requiredRoles: ['admin', 'manager', 'accountant', 'owner']
  },
  { 
    name: 'Bulk Operations', 
    href: '/bulk-operations', 
    icon: '🗂️',
    requiredRoles: ['admin', 'manager', 'accountant', 'owner']
  },
  { 
    name: 'Settings', 
    href: '/settings', 
    icon: '⚙️',
    requiredRoles: ['admin', 'manager', 'owner']
  },
];

const Sidebar = () => {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, signOut } = useSimplifiedAuth();
  const router = useRouter();

  // Check if user has access to a specific route
  const hasAccess = (item: NavItem) => {
    if (!item.requiredRoles) return true;
    const userRole = user?.user_metadata?.role;
    return typeof userRole === 'string' && item.requiredRoles.includes(userRole);
  };

  // Handle window resize
  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 480;
      setIsMobile(isMobileView);
      if (isMobileView) {
        setIsExpanded(false);
        setIsMobileOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (!user) return null;

  const SidebarContent = ({ mobile = false, onMenuItemClick }: { mobile?: boolean, onMenuItemClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Header with toggle button only */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#1A1F36]">
        <div className="flex items-center justify-end">
          {!isMobile && !mobile && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
      
      {/* Navigation items */}
      <div className="px-2 py-3 flex-1">
        <nav className="space-y-1">
          {navigationItems.filter(item => item.name !== 'Settings').map((item) => {
            if (!hasAccess(item)) return null;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-3 text-base rounded-xl transition-colors relative min-h-[44px] w-full",
                  pathname === item.href 
                    ? 'bg-[#0ABAB5] text-white' 
                    : 'text-gray-300 hover:bg-[#2D3748] hover:text-white',
                  mobile ? 'justify-start' : (!isExpanded && "justify-center"),
                  "sm:px-3 sm:py-3 sm:text-sm xs:px-2 xs:py-3 xs:text-base md:px-4 md:py-3 md:text-sm"
                )}
                tabIndex={0}
                onClick={mobile && onMenuItemClick ? onMenuItemClick : undefined}
              >
                {!mobile && (
                  <span className={cn(
                    "transition-all duration-300 text-xl sm:text-base",
                    !isExpanded && "mr-0"
                  )}>{item.icon}</span>
                )}
                <span className={cn(
                  "transition-all duration-300 ml-3 sm:ml-2",
                  (!isExpanded && !mobile) && "opacity-0 w-0",
                  mobile && "ml-0 w-full text-left"
                )}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Settings menu item positioned at the bottom with reduced spacing */}
      {hasAccess(navigationItems.find(item => item.name === 'Settings')!) && (
        <div className="px-2 pb-20">
          <Link
            href="/settings"
            className={cn(
              "group flex items-center px-3 py-3 text-base rounded-xl transition-colors relative min-h-[44px] w-full",
              pathname === '/settings'
                ? 'bg-[#0ABAB5] text-white' 
                : 'text-gray-300 hover:bg-[#2D3748] hover:text-white',
              mobile ? 'justify-start' : (!isExpanded && "justify-center"),
              "sm:px-3 sm:py-3 sm:text-sm xs:px-2 xs:py-3 xs:text-base md:px-4 md:py-3 md:text-sm"
            )}
            tabIndex={0}
            onClick={mobile && onMenuItemClick ? onMenuItemClick : undefined}
          >
            {!mobile && (
              <span className={cn(
                "transition-all duration-300 text-xl sm:text-base",
                !isExpanded && "mr-0"
              )}>⚙️</span>
            )}
            <span className={cn(
              "transition-all duration-300 ml-3 sm:ml-2",
              (!isExpanded && !mobile) && "opacity-0 w-0",
              mobile && "ml-0 w-full text-left"
            )}>
              Settings
            </span>
          </Link>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile menu button */}
        {!isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-[#1A1F36] text-white"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}

        {/* Mobile Sidebar */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-48 bg-[#1A1F36] text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex flex-col h-full">
            {/* Navigation */}
            <div className="flex-1 overflow-y-auto p-0">
              <SidebarContent mobile={true} onMenuItemClick={() => setIsMobileOpen(false)} />
            </div>

            {/* User Section */}
            <div className="p-4 border-t border-white/10">
              <div className="flex flex-col items-center w-full gap-2 sm:items-start">
                <p className="font-medium truncate w-full text-center sm:text-left">{String(user.email)}</p>
                <p className="text-sm text-gray-400 truncate w-full text-center sm:text-left">{String(user.user_metadata?.role || 'User')}</p>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 mt-2"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div 
      className={cn(
        "bg-[#1A1F36] text-white h-screen fixed left-0 top-0 transition-all duration-300 z-30",
        isExpanded ? "w-48" : "w-14"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <SidebarContent />
    </div>
  );
};

export default Sidebar; 