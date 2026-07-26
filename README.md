# Almonium Mobile

Expo/React Native client for Almonium. The current mobile foundation includes:

This is one of four coordinated repositories: `almonium-be` provides the API,
`almonium-fe` is the browser client, and `almonium-infra` deploys the
server-hosted FE/BE services. Mobile uses Firebase ID-token bearer
authentication and native/Expo distribution; it does not use the browser's
HttpOnly session cookie and is not currently deployed as an infra container.

- Firebase email/password registration, verification, login, reset, and persistent sessions;
- native Google sign-in on Android/iOS and Sign in with Apple on iOS;
- Firebase ID-token bearer authentication against `almonium-be`;
- protected Expo Router navigation;
- resumable native onboarding from welcome through languages, CEFR, profile, and interests;
- searchable, sectioned, multi-language bookshelves and full book details;
- favorites, language variants, resettable progress, and parallel-reading support;
- a reader with reliable resume, retryable progress sync, text sizing, and paper/night themes;
- profile, privacy, interests, target-language, CEFR, account deletion, and plan summary;
- searchable multi-language flashcards with create, edit, tag, and delete flows;
- device-local spaced-repetition sessions with Again/Hard/Good/Easy scheduling;
- an in-app notification inbox with unread badges, read/unread actions, and deletion;
- password, Google, or Apple reauthentication before destructive account deletion;
- status-aware API retries, profile-bootstrap recovery, and user-isolated query caches;
- persisted shelf/detail caches with native online and app-focus awareness;
- unit coverage for navigation, backend error contracts, language presentation, and progress queues.

Review timing is currently stored per Firebase user and language on the device.
The backend card entity does not yet persist its exposed review metadata, so
the mobile client does not claim cross-device scheduling. Card content itself
is stored through the shared backend API.

The inbox reads persisted backend notifications. Remote push registration is
intentionally deferred: the backend currently accepts native FCM device tokens,
not Expo Push Service tokens, and production push credentials are not available
to this repository.

## Local setup

Requirements: Node 20.19+ and the neighboring `../almonium-be` repository.

```bash
cp .env.example .env.local
npm install
npm run check
npm start
```

The defaults target the backend at:

- iOS simulator/web: `http://localhost:8080`;
- Android emulator: `http://10.0.2.2:8080`.

For Expo Go on a physical device, set `EXPO_PUBLIC_API_URL` in `.env.local` to
the computer's LAN URL. Never point local development at a deployed database;
run the backend using its documented `local` profile.

Firebase's client configuration is intentionally public and has safe tracked
defaults matching the web app. Never add a Firebase Admin/service-account key
to this repository.

## Native provider setup

Apple sign-in uses the `com.almonium.mobile` bundle identifier and requires an
iOS development build plus the existing Firebase Apple provider configuration.

Google sign-in uses the native Google Sign-In SDK and therefore requires a
development build rather than Expo Go. The Android and iOS OAuth clients must
remain registered in the existing Firebase/Google Cloud project; Android build
and Play signing-certificate SHA-1 fingerprints must be attached to the Android
client. Supply the public client identifiers through:

```text
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
```

The iOS client ID also determines the URL scheme configured in `app.json`.
OAuth client IDs are public identifiers; no provider secret belongs in the
mobile app.

## Authentication architecture

The app keeps the Firebase user through React Native persistence and sends a
fresh Firebase ID token in the `Authorization: Bearer` header. The backend
verifies the token, maps its immutable Firebase UID to the product user, and
applies revocation-aware recent-login checks to sensitive operations.

Browser clients continue using the Secure, HttpOnly session cookie. Bearer
requests do not use cookie CSRF tokens because they are not ambient browser
credentials.

## Useful commands

```bash
npm run check
npm test
npm run android
npm run ios
npm run web
```

Use a development build for native Google and Apple auth. Expo Go remains
useful for the email/password, library, settings, and reader flows.

`eas.json` includes development, internal-preview, and production build
profiles. The app config is linked to the `almonium-app` Expo account and its
Almonium EAS project.
