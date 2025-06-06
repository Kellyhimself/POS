import { createClient } from '@/lib/supabase-clients/pages';
import { AuthError, User, Session } from '@supabase/supabase-js';

interface SignUpResponse {
  data: {
    user: User | null;
    session: Session | null;
  } | null;
  error: AuthError | null;
}

export const signUp = async (email: string, password: string, role: string, store_id: string): Promise<SignUpResponse> => {
  const supabase = createClient();
  
  try {
    // First verify the store exists
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', store_id)
      .single();

    if (storeError || !store) {
      console.error('Store not found:', storeError);
      return { data: null, error: new Error('Store not found') as AuthError };
    }

    // Start a transaction
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          store_id,
        },
      },
    });

    if (authError) {
      console.error('Error during signup:', authError);
      return { data: null, error: authError };
    }

    if (!authData?.user) {
      console.error('No user data returned from signup');
      return { data: null, error: new Error('No user data returned') as AuthError };
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        store_id,
        role
      });
    
    if (profileError) {
      console.error('Error creating user profile:', profileError);
      // If profile creation fails, we should delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { data: null, error: profileError as unknown as AuthError };
    }

    return { data: { user: authData.user, session: authData.session }, error: null };
  } catch (error) {
    console.error('Unexpected error during signup:', error);
    return { data: null, error: error as AuthError };
  }
};

export const signIn = async (email: string, password: string) => {
  const supabase = createClient();
  console.log('Signing in...');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }

    if (data?.session) {
      console.log('Session obtained, setting session...');
      // Ensure the session is set in the client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        console.error('Error setting session:', sessionError);
        return { data: null, error: sessionError };
      }

      return { data: { session: data.session }, error: null };
    }

    return { data: null, error: new Error('No session data') as AuthError };
  } catch (error) {
    console.error('Unexpected error during sign in:', error);
    return { data: null, error: error as AuthError };
  }
};

export const signOut = async () => {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const supabase = createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Error getting session:', sessionError);
    return { data: { user: null, session: null }, error: sessionError };
  }

  if (!session) {
    return { data: { user: null, session: null }, error: null };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Error getting user:', userError);
    return { data: { user: null, session: null }, error: userError };
  }

  return { data: { user, session }, error: null };
}; 