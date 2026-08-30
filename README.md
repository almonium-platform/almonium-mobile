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
- a language-aware Home hub with continue-reading, recent-card, and due-review shortcuts;
- searchable, sectioned, multi-language bookshelves and full book details;
- favorites, language variants, resettable progress, and parallel-reading support;
- a reader with reliable resume, retryable progress sync, text sizing, and paper/night themes;
- profile, privacy, interests, target-language, CEFR, account deletion, and plan summary;
- searchable multi-language flashcards with create, edit, tag, and delete flows;
- server-synchronised review sessions with typed answers, hints, confusion feedback, and FSRS scheduling;
- a Play hub that reflects available decks without presenting unfinished games as playable;
- reader search, friendship requests, friend/block management, and shareable public profiles;
- an actionable notification inbox with unread badges, relationship actions, and deletion;
- membership usage/status details and secure browser handoff to the backend billing portal;
- password, Google, or Apple reauthentication before destructive account deletion;
- status-aware API retries, profile-bootstrap recovery, and user-isolated query caches;
- persisted shelf/detail caches with native online and app-focus awareness;
- unit coverage for navigation, backend error contracts, language presentation, and progress queues.

Review timing and evidence are owned by the backend. Mobile reads the same due
summary as the web client, answers persisted ten-item sessions, and never
calculates or submits scheduling intervals on the handset.

The inbox reads persisted backend notifications. Remote push registration is
intentionally deferred: the backend currently accepts native FCM device tokens,
not Expo Push Service tokens, and production push credentials are not available
to this repository.

The browser client's game routes are still placeholders, so mobile currently
ships the Play discovery hub but labels the games as in development. New store
purchases are also deferred; existing paid members can manage Paddle billing
through the backend-created customer portal.

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

## Phone releases from `main`

Pushing to `main` triggers [`.github/workflows/internal-release.yml`](.github/workflows/internal-release.yml).
It runs the checks, creates store-ready Android and iOS builds on EAS, and
submits the finished binaries automatically:

- Android goes to the Google Play **Internal testing** track. Testers join the
  internal-test link once, then install and update Almonium through Google Play.
- iOS goes to App Store Connect and becomes available through **TestFlight**
  after Apple's processing. Team members may use internal TestFlight testing;
  friends outside the App Store Connect team use external TestFlight testing or
  a public link. The first external build can require Apple's beta review.

This is a production-candidate pipeline, not a public store release. The
Android profile targets Google Play's internal testing track and the iOS
submission stops at TestFlight. A Google Play production rollout and App Store
review submission are deliberate manual release decisions made only after the
store listings, privacy material, testing, and review readiness are complete.

### When to add staging

For the current early-testing phase, use only two lanes:

| Source | App/API | Distribution |
| --- | --- | --- |
| local work | local backend | development build / Expo Go where supported |
| `main` | production app and `https://api.almonium.com` | Google Play Internal Testing and TestFlight |

This lets trusted friends test the real production configuration without making
the app public. Do not create a `develop` branch or staging variant merely for
this purpose.

Add staging later when changes need to be tested against
`https://staging.api.almonium.com` without affecting the real product. That
lane must be a separately installable **Almonium Staging** app, using
`com.almonium.mobile.staging` as both its Android application ID and iOS bundle
identifier. Reusing the production identifiers would replace the production
app on a phone. It would need separate Android/iOS OAuth clients, but not
automatically a separate Firebase project. A separate Firebase project is only
needed when staging identities and Firebase data must be isolated from
production; that choice also requires matching backend Firebase verification
configuration.

This uses the operating systems' normal test distribution paths. `expo export`
only exports the JavaScript/web bundle; it cannot create an installable Android
or iOS app. EAS internal-distribution builds remain useful for ad hoc testing,
but iOS ad hoc builds require every device UDID to be registered and a rebuild
when the device list changes.

### One-time release setup

Before the production-candidate workflow is enabled, complete these account-side steps. Keep all
credentials in EAS or GitHub; do not commit them to this repository.

1. In the Almonium EAS project, add a project-scoped production environment
   variable named `EXPO_PUBLIC_API_URL` with the value
   `https://api.almonium.com` and **Plain text** visibility. Do not append
   `/api/v1`: the mobile client adds that path itself. The other tracked public
   Firebase values may use their defaults; do not add Firebase Admin keys or
   provider secrets to EAS environment variables.
2. Create the `com.almonium.mobile` app in Google Play Console and App Store
   Connect. Both require their respective paid developer accounts.
3. In Google Play Console, upload the first Android App Bundle manually, then
   create a Google Play service account with access to this app and upload its
   JSON key under the Almonium EAS project's Android service credentials.
4. In App Store Connect, create an App Store Connect API key, grant it access
   to the app, and add the key to the Almonium EAS project's iOS submission
   credentials. Get the app's numeric **Apple ID**, then add it to
   `eas.json` as follows (the Apple ID is an identifier, not a secret):

   ```json
   {
     "submit": {
       "production": {
         "ios": {
           "ascAppId": "1234567890"
         }
       }
     }
   }
   ```

5. Create an Expo robot-user token with access to this EAS project and add it
   to this GitHub repository as the `EXPO_TOKEN` Actions secret.

The Android submit profile already targets the internal track. EAS increments
the Android version code and iOS build number remotely for every production
build, so each push is acceptable to both stores. TestFlight delivery normally
takes a short Apple processing period; it is not an App Store production
release. Internal TestFlight testing does not require a public App Store
release; inviting external TestFlight testers can require Apple's beta review.
