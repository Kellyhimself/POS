import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface UnauthorizedAccessProps {
  requiredRoles?: string[];
  redirectTo?: string;
}

export function UnauthorizedAccess({ requiredRoles, redirectTo = '/pos' }: UnauthorizedAccessProps) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (redirectTo) {
      router.push(redirectTo);
    }
  }, [redirectTo, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1A1F36] text-white p-4">
      <div className="text-6xl mb-4">🔒</div>
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-gray-400 text-center mb-4">
        You don't have permission to access this page.
        {requiredRoles && (
          <span className="block mt-2">
            Required roles: {requiredRoles.join(', ')}
          </span>
        )}
      </p>
      <button
        onClick={() => router.push(redirectTo)}
        className="px-4 py-2 bg-[#0ABAB5] text-white rounded-lg hover:bg-[#0ABAB5]/90 transition-colors"
      >
        Return to POS
      </button>
    </div>
  );
} 