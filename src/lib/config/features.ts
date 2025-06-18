export interface FeatureFlags {
  ONLINE_MODE_ENABLED: boolean;
  OFFLINE_MODE_ENABLED: boolean;
  REAL_TIME_SUBSCRIPTIONS: boolean;
  OPTIMISTIC_LOCKING: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
  ONLINE_MODE_ENABLED: true,
  OFFLINE_MODE_ENABLED: true,
  REAL_TIME_SUBSCRIPTIONS: true,
  OPTIMISTIC_LOCKING: true,
};

// User-specific feature flags (stored in user preferences)
export interface UserPreferences {
  preferred_mode: 'offline' | 'online' | 'auto';
  auto_switch_threshold: number; // seconds of offline time before switching
  sync_interval: number; // for offline mode
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferred_mode: 'auto',
  auto_switch_threshold: 30, // 30 seconds
  sync_interval: 60000, // 1 minute
};

// Helper functions for feature management
export function getFeatureFlags(): FeatureFlags {
  // In the future, this could fetch from environment variables or user settings
  return DEFAULT_FEATURES;
}

export function getUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_USER_PREFERENCES;
  }
  
  const stored = localStorage.getItem('user_preferences');
  if (stored) {
    try {
      return { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(stored) };
    } catch (error) {
      console.error('Failed to parse user preferences:', error);
    }
  }
  
  return DEFAULT_USER_PREFERENCES;
}

export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  if (typeof window === 'undefined') return;
  
  const current = getUserPreferences();
  const updated = { ...current, ...preferences };
  
  try {
    localStorage.setItem('user_preferences', JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save user preferences:', error);
  }
} 