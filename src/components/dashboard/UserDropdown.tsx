'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Get user initials for the avatar
  const userInitials = user?.email ? user.email.substring(0, 2).toUpperCase() : 'US';

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative ml-4" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 border border-blue-200 flex items-center justify-center hover:from-blue-200 hover:to-purple-200 transition-all duration-200"
      >
        <span className="text-xs font-medium text-blue-700">{userInitials}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-purple-200">
          <div className="px-4 py-2 border-b">
            <p className="text-sm font-medium truncate">{user?.email}</p>
          </div>
          <Link
            href="/dashboard/settings"
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Account Settings
          </Link>
          <Link
            href="/dashboard/settings/profile"
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Edit Profile
          </Link>
          <button
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
