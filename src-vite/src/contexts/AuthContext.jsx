// OJT Master v2.3.0 - Authentication Context

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/api';
import { dbGetAll, dbSave } from '../utils/db';
import { SecureSession, getViewStateByRole } from '../utils/helpers';
import { VIEW_STATES, ROLES } from '../constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [viewState, setViewState] = useState(VIEW_STATES.LOADING);
  const [sessionMode, setSessionMode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Display role (considers session mode for admin)
  const displayRole = sessionMode || user?.role;

  // Load user profile
  const loadUserProfile = useCallback(async (session) => {
    if (!session?.user) {
      setViewState(VIEW_STATES.ROLE_SELECT);
      setIsLoading(false);
      return;
    }

    try {
      // Check local cache first
      const localUsers = await dbGetAll('users');
      let profile = localUsers.find((u) => u.id === session.user.id);

      // If not in cache, fetch from Supabase
      if (!profile) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        profile = data;
      }

      if (profile && profile.role) {
        // Valid profile with role
        setUser({
          id: profile.id,
          name: profile.name || session.user.user_metadata?.full_name,
          email: session.user.email,
          role: profile.role,
          department: profile.department,
        });

        // Restore session mode if admin
        const tempMode = SecureSession.get('ojt_sessionMode');
        if (profile.role === ROLES.ADMIN && tempMode) {
          setSessionMode(tempMode);
        }

        setViewState(getViewStateByRole(profile.role, tempMode));
      } else if (profile && !profile.role) {
        // Corrupted cache: profile exists but no role - treat as new user
        console.warn('Corrupted user cache detected (no role), clearing...');
        setUser({
          id: session.user.id,
          name: profile.name || session.user.user_metadata?.full_name,
          email: session.user.email,
          role: null,
        });
        setViewState(VIEW_STATES.ROLE_SELECT);
      } else {
        // New user - needs role selection
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name,
          email: session.user.email,
          role: null,
        });
        setViewState(VIEW_STATES.ROLE_SELECT);
      }
    } catch (error) {
      console.error('Profile load error:', error);
      setViewState(VIEW_STATES.ROLE_SELECT);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth loading timeout - forcing role select view');
        setIsLoading(false);
        setViewState(VIEW_STATES.ROLE_SELECT);
      }
    }, 15000); // 15 second max loading time

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserProfile(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserProfile(session);
    });

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [loadUserProfile, isLoading]);

  // Google login
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  // Logout
  const handleLogout = async () => {
    SecureSession.remove('ojt_sessionMode');
    setSessionMode(null);
    await supabase.auth.signOut();
    setUser(null);
    setViewState(VIEW_STATES.ROLE_SELECT);
  };

  // Select role (for new users)
  const handleRoleSelect = async (selectedRole) => {
    if (!user) return;

    try {
      const userData = {
        id: user.id,
        name: user.name,
        role: selectedRole,
        department: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await dbSave('users', userData);

      setUser((prev) => ({ ...prev, role: selectedRole }));
      setViewState(getViewStateByRole(selectedRole));
    } catch (error) {
      console.error('Role save error:', error);
      throw error;
    }
  };

  // Switch mode (for admin only)
  const handleModeSwitch = (mode) => {
    if (user?.role !== ROLES.ADMIN) return;

    if (mode === 'mentor') {
      SecureSession.set('ojt_sessionMode', 'mentor');
      setSessionMode('mentor');
      setViewState(VIEW_STATES.MENTOR_DASHBOARD);
    } else {
      SecureSession.remove('ojt_sessionMode');
      setSessionMode(null);
      setViewState(VIEW_STATES.ADMIN_DASHBOARD);
    }
  };

  const value = {
    user,
    viewState,
    setViewState,
    sessionMode,
    displayRole,
    isLoading,
    handleGoogleLogin,
    handleLogout,
    handleRoleSelect,
    handleModeSwitch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
