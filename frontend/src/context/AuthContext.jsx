import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('vendorflow_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state by verifying stored token
  const verifyStoredAuth = useCallback(async () => {
    const storedToken = localStorage.getItem('vendorflow_token');
    if (!storedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await authService.getMe();
      if (data.success && data.data?.user) {
        setUser(data.data.user);
      } else {
        throw new Error('User verification failed');
      }
    } catch {
      // Stored token was invalid or expired
      localStorage.removeItem('vendorflow_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyStoredAuth();
  }, [verifyStoredAuth]);

  /**
   * Log in user with credentials
   */
  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res.success && res.data) {
      const { user: authUser, token: authToken } = res.data;
      localStorage.setItem('vendorflow_token', authToken);
      setToken(authToken);
      setUser(authUser);
      return authUser;
    }
    throw new Error(res.message || 'Login failed');
  };

  /**
   * Register new user (Vendor)
   */
  const register = async (dataOrName, email, password) => {
    const payload =
      typeof dataOrName === 'object' && dataOrName !== null
        ? dataOrName
        : { name: dataOrName, email, password };
    const res = await authService.register(payload);
    if (res.success && res.data) {
      const { user: authUser, token: authToken } = res.data;
      localStorage.setItem('vendorflow_token', authToken);
      setToken(authToken);
      setUser(authUser);
      return res.data;
    }
    throw new Error(res.message || 'Registration failed');
  };

  /**
   * Log out user and clear storage
   */
  const logout = () => {
    localStorage.removeItem('vendorflow_token');
    setToken(null);
    setUser(null);
  };

  /**
   * Check if current user has any of the specified roles
   */
  const hasRole = (...roles) => {
    if (!user || !user.role) return false;
    return roles.includes(user.role);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
