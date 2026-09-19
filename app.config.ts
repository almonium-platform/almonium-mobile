import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One codebase, two installable identities. `APP_VARIANT` is set per EAS build profile (see
 * eas.json): `preview` and `development` build the staging app, `production` the store app. The
 * two differ only in what makes an app distinct to the OS and to the identity providers, so both
 * can sit on one phone: bundle id, name, URL scheme, the links they claim and the Google iOS
 * client bound to the bundle id. Everything the app talks to (API, Firebase project, Stream) still
 * comes from the EAS environment, not from the variant.
 */
type Variant = 'production' | 'staging';

const variant: Variant = process.env.APP_VARIANT === 'staging' ? 'staging' : 'production';

const identity = {
  production: {
    name: 'Almonium',
    applicationId: 'com.almonium.mobile',
    scheme: 'almonium',
    linkHost: 'almonium.com',
    // Reversed iOS OAuth client id from the `almonium` Google Cloud project; it must match the
    // client bound to this bundle id there, or Google Sign-In never returns to the app.
    googleIosUrlScheme: 'com.googleusercontent.apps.33380019461-pcob2v5bj8ad1bh6s6kdvc502f1duuld',
    icon: './assets/images/icon.png',
    androidForeground: './assets/images/android-icon-foreground.png',
  },
  staging: {
    name: 'Almonium Staging',
    applicationId: 'com.almonium.mobile.staging',
    scheme: 'almonium-staging',
    linkHost: 'staging.almonium.com',
    googleIosUrlScheme: 'com.googleusercontent.apps.STAGING_IOS_CLIENT_ID',
    // The same mark with a STAGING band, so the two installs read apart on a home screen.
    icon: './assets/images/icon-staging.png',
    androidForeground: './assets/images/android-icon-foreground-staging.png',
  },
}[variant];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: identity.name,
  slug: 'almonium',
  version: '1.0.0',
  orientation: 'portrait',
  icon: identity.icon,
  scheme: identity.scheme,
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: identity.applicationId,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains: [`applinks:${identity.linkHost}`],
  },
  android: {
    package: identity.applicationId,
    adaptiveIcon: {
      backgroundColor: '#F9F6F5',
      foregroundImage: identity.androidForeground,
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: identity.linkHost, pathPrefix: '/c/' },
          { scheme: 'https', host: identity.linkHost, pathPrefix: '/d/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    output: 'static',
    favicon: './assets/images/almonium-logo.png',
  },
  plugins: [
    'expo-router',
    'expo-notifications',
    'expo-apple-authentication',
    [
      'expo-splash-screen',
      {
        image: './assets/images/almonium-logo.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#F9F6F5',
        dark: { backgroundColor: '#14111A' },
      },
    ],
    ['@react-native-google-signin/google-signin', { iosUrlScheme: identity.googleIosUrlScheme }],
    [
      'expo-build-properties',
      {
        ios: {
          extraPods: [
            { name: 'GoogleUtilities', modular_headers: true },
            { name: 'RecaptchaInterop', modular_headers: true },
          ],
        },
      },
    ],
    'expo-asset',
    'expo-localization',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: { projectId: 'db1f6412-0a43-442d-bdc6-b3de66f929c7' },
    variant,
  },
  owner: 'almonium',
  runtimeVersion: { policy: 'fingerprint' },
  updates: { url: 'https://u.expo.dev/db1f6412-0a43-442d-bdc6-b3de66f929c7' },
});
