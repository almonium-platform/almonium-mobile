import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  OAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { api } from '@/src/api';
import { withoutStreamToken } from '@/src/chat';
import { config } from '@/src/config';
import { auth } from '@/src/firebase';
import { queryClient } from '@/src/query-client';
import type { UserInfo } from '@/src/types';

interface AuthState {
  firebaseUser: User | null;
  profile: UserInfo | null;
  profileError: string | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  register(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  reauthenticateWithPassword(password: string): Promise<void>;
  reauthenticateWithGoogle(): Promise<void>;
  reauthenticateWithApple(): Promise<void>;
  logOut(): Promise<void>;
  refreshProfile(): Promise<void>;
  retryProfile(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const profileCacheKey = (uid: string) => `almonium:profile:${uid}`;
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

class ProviderSignInCancelledError extends Error {
  readonly code = 'ERR_REQUEST_CANCELED';
}

async function googleFirebaseCredential(): Promise<AuthCredential> {
  if (isExpoGo) {
    throw new Error('Google sign-in is unavailable in Expo Go. Use email and password, or open a development build.');
  }
  const platformClientId =
    Platform.OS === 'ios' ? config.google.iosClientId : config.google.androidClientId;
  if (!config.google.webClientId || !platformClientId) {
    throw new Error(`Google sign-in is not configured for ${Platform.OS}.`);
  }

  const { GoogleSignin, isCancelledResponse } = await import(
    '@react-native-google-signin/google-signin'
  );
  GoogleSignin.configure({
    webClientId: config.google.webClientId,
    iosClientId: config.google.iosClientId,
  });
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) throw new ProviderSignInCancelledError();
  if (!response.data.idToken) throw new Error('Google did not return an identity token.');
  return GoogleAuthProvider.credential(response.data.idToken);
}

async function appleFirebaseCredential(): Promise<AuthCredential> {
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
  return new OAuthProvider('apple.com').credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserInfo | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const previousUid = useRef<string | null>(null);

  const loadProfile = useCallback(async (user: User) => {
    if (!user.emailVerified) {
      setProfile(null);
      return;
    }
    const nextProfile = await api.me();
    // The Stream token is a credential and lives only in memory; it comes back with /users/me.
    await AsyncStorage.setItem(
      profileCacheKey(user.uid),
      JSON.stringify(withoutStreamToken(nextProfile)),
    ).catch(() => undefined);
    setProfile(nextProfile);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (previousUid.current !== user?.uid) {
          queryClient.clear();
          previousUid.current = user?.uid ?? null;
        }
        setFirebaseUser(user);
        setProfileError(null);
        try {
          if (user) {
            setProfile(null);
            await loadProfile(user);
          }
          else setProfile(null);
        } catch (error) {
          const cached = user
            ? await AsyncStorage.getItem(profileCacheKey(user.uid)).catch(() => null)
            : null;
          if (cached) {
            try {
              setProfile(JSON.parse(cached) as UserInfo);
            } catch {
              setProfileError(error instanceof Error ? error.message : 'Could not load your profile.');
            }
          } else {
            setProfileError(error instanceof Error ? error.message : 'Could not load your profile.');
          }
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
      profileError,
      loading,
      async signIn(email, password) {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!credential.user.emailVerified) {
          await api.requestEmailVerification();
          await signOut(auth);
          throw new Error('Verify your email first. We sent you a fresh verification link.');
        }
        await loadProfile(credential.user);
      },
      async signInWithGoogle() {
        const credential = await signInWithCredential(auth, await googleFirebaseCredential());
        await loadProfile(credential.user);
      },
      async signInWithApple() {
        const credential = await signInWithCredential(auth, await appleFirebaseCredential());
        await loadProfile(credential.user);
      },
      async register(email, password) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        try {
          await api.requestEmailVerification();
        } finally {
          await signOut(auth);
        }
      },
      async resetPassword(email) {
        await api.requestPasswordReset(email.trim());
      },
      async reauthenticateWithPassword(password) {
        const user = auth.currentUser;
        if (!user?.email) throw new Error('This account does not have an email address.');
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email, password),
        );
        await user.getIdToken(true);
      },
      async reauthenticateWithGoogle() {
        const user = auth.currentUser;
        if (!user) throw new Error('Sign in required.');
        await reauthenticateWithCredential(user, await googleFirebaseCredential());
        await user.getIdToken(true);
      },
      async reauthenticateWithApple() {
        const user = auth.currentUser;
        if (!user) throw new Error('Sign in required.');
        await reauthenticateWithCredential(user, await appleFirebaseCredential());
        await user.getIdToken(true);
      },
      async logOut() {
        const currentUser = auth.currentUser;
        const uid = currentUser?.uid;
        const usesGoogle = currentUser?.providerData.some(
          (provider) => provider.providerId === 'google.com',
        );
        if (usesGoogle && Platform.OS !== 'web' && !isExpoGo) {
          const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
          await GoogleSignin.signOut().catch(() => undefined);
        }
        await signOut(auth);
        queryClient.clear();
        if (uid) await AsyncStorage.removeItem(profileCacheKey(uid));
        setProfile(null);
      },
      async refreshProfile() {
        if (auth.currentUser) {
          setProfileError(null);
          await loadProfile(auth.currentUser);
        }
      },
      async retryProfile() {
        if (!auth.currentUser) return;
        setLoading(true);
        setProfileError(null);
        try {
          await loadProfile(auth.currentUser);
        } catch (error) {
          setProfileError(error instanceof Error ? error.message : 'Could not load your profile.');
        } finally {
          setLoading(false);
        }
      },
    }),
    [firebaseUser, profile, profileError, loading, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
