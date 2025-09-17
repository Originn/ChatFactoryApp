'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
}

export default function ComingSoonAwarePage({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [bypassStatus, setBypassStatus] = useState(false);
  const { canBypassComingSoon } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      // If coming soon mode is disabled, always show content
      if (process.env.NEXT_PUBLIC_COMING_SOON !== 'true') {
        setLoading(false);
        return;
      }

      // Check if user has bypass from auth context
      if (canBypassComingSoon) {
        setBypassStatus(true);
        setLoading(false);
        return;
      }

      // Check bypass via API (for IP-based bypass)
      try {
        const response = await fetch('/api/bypass-check');
        const result = await response.json();

        if (result.success && result.bypass.canBypass) {
          console.log('🟢 Page-level bypass granted:', result.bypass.reason);
          setBypassStatus(true);
        } else {
          console.log('🔴 No bypass, redirecting to coming soon');
          router.replace('/coming-soon');
          return;
        }
      } catch (error) {
        console.error('❌ Bypass check failed:', error);
        router.replace('/coming-soon');
        return;
      }

      setLoading(false);
    };

    checkAccess();
  }, [canBypassComingSoon, router]);

  // Show loading state while checking bypass
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show content if bypass is granted or coming soon is disabled
  return <>{children}</>;
}