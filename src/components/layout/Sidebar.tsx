"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'POS', href: '/pos', icon: '💳' },
    { name: 'Inventory', href: '/inventory', icon: '📦' },
    { name: 'Reports', href: '/reports', icon: '📈' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
    { name: 'Bulk Operations', href: '/bulk-operations', icon: '🗂️' },
  ];

  return (
    <div className="w-64 bg-[#1A1F36] text-white h-screen fixed left-0 top-0 pt-20">
      <div className="px-6 mb-8">
        <h1 className="text-xl font-bold text-white">POS System</h1>
      </div>
      
      <nav className="px-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-4 py-3 text-sm rounded-lg transition-colors ${
              pathname === item.href 
                ? 'bg-[#0ABAB5] text-white' 
                : 'text-gray-300 hover:bg-[#2D3748] hover:text-white'
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar; 