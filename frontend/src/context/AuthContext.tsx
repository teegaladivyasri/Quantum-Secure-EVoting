import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import type { UserProfile } from '../services/api';

export type { UserProfile };

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  initiateVoterLogin: (voterId: string) => Promise<{ stageToken: string; maskedMobile: string; deliveryMode?: string; message: string }>;
  verifyVoterOtp: (stageToken: string, otp: string) => Promise<{ stageToken: string; message: string }>;
  resendVoterOtp: (stageToken: string) => Promise<{ message: string; maskedMobile?: string; deliveryMode?: string }>;
  verifyVoterIdentity: (stageToken: string, data: { is_demo_fallback?: boolean; frame_data?: string }) => Promise<UserProfile>;
  loginAdmin: (username: string, password: string) => Promise<UserProfile>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVoter: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('auth_token');
  });

  const [loading, setLoading] = useState<boolean>(true);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const login = (newToken: string, newUser: UserProfile) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
  };

  const initiateVoterLogin = async (voterId: string) => {
    const res = await api.initiateVoter({ voter_id: voterId });
    return {
      stageToken: res.data.stage_token,
      maskedMobile: res.data.masked_mobile,
      deliveryMode: res.data.delivery_mode || 'demo',
      message: res.data.message
    };
  };

  const verifyVoterOtp = async (stageToken: string, otp: string) => {
    const res = await api.verifyVoterOtp({ stage_token: stageToken, otp });
    return {
      stageToken: res.data.stage_token,
      message: res.data.message
    };
  };

  const resendVoterOtp = async (stageToken: string) => {
    const res = await api.resendVoterOtp({ stage_token: stageToken });
    return {
      message: res.data.message,
      maskedMobile: res.data.masked_mobile,
      deliveryMode: res.data.delivery_mode || 'demo'
    };
  };

  const verifyVoterIdentity = async (stageToken: string, data: { is_demo_fallback?: boolean; frame_data?: string }) => {
    const res = await api.verifyVoterIdentity({ stage_token: stageToken, ...data });
    const { token: finalToken, user: authedUser } = res.data;
    login(finalToken, authedUser);
    return authedUser;
  };

  const loginAdmin = async (username: string, password: string) => {
    const res = await api.loginAdmin({ username, password });
    const { token: adminToken, user: authedUser } = res.data;
    login(adminToken, authedUser);
    return authedUser;
  };

  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.data.user);
          localStorage.setItem('auth_user', JSON.stringify(res.data.user));
        } catch {
          // Token invalid or expired
          logout();
        }
      }
      setLoading(false);
    };

    verifySession();
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        initiateVoterLogin,
        verifyVoterOtp,
        resendVoterOtp,
        verifyVoterIdentity,
        loginAdmin,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === 'ADMIN',
        isVoter: user?.role === 'VOTER',
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
