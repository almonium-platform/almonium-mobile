import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  OAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { api } from '@/src/api';
import { auth } from '@/src/firebase';
import { queryClient } from '@/src/query-client';
import type { UserInfo } from '@/src/types';

interface AuthState {
  firebaseUser: User | null;
  profile: UserInfo | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signInWithApple(): Promise<void>;
  register(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  logOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (user: User) => {
    if (!user.emailVerified) {
      setProfile(null);
      return;
    }
    const nextProfile = await api.me();
    setProfile(nextProfile);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        setFirebaseUser(user);
        try {
          if (user) await loadProfile(user);
          else setProfile(null);
        } finally {
          setLoading(false);
        }
      }),
    [loadProfile],
  );

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      profile,
      loading,
      async signIn(email, password) {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          await signOut(auth);
          throw new Error('Verify your email first. We sent you a fresh verification link.');
        }
        await loadProfile(credential.user);
      },
      async signInWithApple() {
        const rawNonce = Crypto.randomUUID();
        const nonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce,
        );
        const appleCredential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce,
        });
        if (!appleCredential.identityToken) throw new Error('Apple did not return an identity token.');
        const provider = new OAuthProvider('apple.com');
        const firebaseCredential = provider.credential({
          idToken: appleCredential.identityToken,
          rawNonce,
        });
        const credential = await signInWithCredential(auth, firebaseCredential);
        await loadProfile(credential.user);
      },
      async register(email, password) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(credential.user);
        await signOut(auth);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim());
      },
      async logOut() {
        await signOut(auth);
        queryClient.clear();
        setProfile(null);
      },
      async refreshProfile() {
        if (auth.currentUser) await loadProfile(auth.currentUser);
      },
    }),
    [firebaseUser, profile, loading, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
