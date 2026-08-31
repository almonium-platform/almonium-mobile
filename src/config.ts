import { Platform } from 'react-native';

const localApiHost = Platform.OS === 'android' ? 'http://10.0.2.2:9998' : 'http://localhost:9998';

export const config = {
  apiBaseUrl: `${process.env.EXPO_PUBLIC_API_URL || localApiHost}/api/v1`,
  webBaseUrl: process.env.EXPO_PUBLIC_WEB_URL || 'https://almonium.com',
  // Public Stream application key, the counterpart of the token the backend mints on /users/me.
  // It must belong to the same Stream application as the API this build talks to, so the default
  // is the staging key that pairs with the default local backend.
  streamApiKey: process.env.EXPO_PUBLIC_STREAM_API_KEY || 'zjh3fpuaexy2',
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCotfh0KzDpP3HniEfxyxoAw9HUFAA8gFs',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'almonium.firebaseapp.com',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'almonium',
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'almonium.firebasestorage.app',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '33380019461',
    appId:
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:33380019461:web:6b4381869fdf5ec21ddb6c',
  },
  google: {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  },
} as const;
