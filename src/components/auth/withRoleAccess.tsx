import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import { UnauthorizedAccess } from './UnauthorizedAccess';
import { ComponentType } from 'react';

export function withRoleAccess<P extends object>(
  WrappedComponent: ComponentType<P>,
  requiredRoles?: string[],
  redirectTo: string = '/pos'
) {
  return function WithRoleAccess(props: P) {
    const { user } = useSimplifiedAuth();
    const userRole = user?.user_metadata?.role;

    // If no roles are required, allow access
    if (!requiredRoles) {
      return <WrappedComponent {...props} />;
    }

    // Check if user has required role
    const hasAccess = requiredRoles.includes(userRole);

    if (!hasAccess) {
      return <UnauthorizedAccess requiredRoles={requiredRoles} redirectTo={redirectTo} />;
    }

    return <WrappedComponent {...props} />;
  };
} 