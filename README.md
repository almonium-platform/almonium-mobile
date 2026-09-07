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

`eas.json` includes development, preview, and production build
profiles. The app config is linked to the `almonium-app` Expo account and its
Almonium EAS project.

## Every push to `develop` lands on your phone

Pushing to `develop` triggers [`.github/workflows/develop-to-phone.yml`](.github/workflows/develop-to-phone.yml).
It runs the checks and then keeps the internal **preview** build on your phone
current:

- **JS-only changes** are published with EAS Update to the `develop` channel.
  An installed preview build downloads the update in the background on its
  next launch and runs it on the launch after that. No reinstall is needed.
- **Native changes** (a new native module, app config, an SDK upgrade, anything
  that changes the `@expo/fingerprint` hash) rebuild the binary on EAS: an APK
  for Android and an ad hoc IPA for iOS. The workflow waits for the build and
  prints the install link in the job summary; the build also appears on the
  project's expo.dev builds page. Open the link on the phone and install it
  over the previous build. The first install on a phone always needs this step.
- **Optional push notification:** add an `NTFY_TOPIC` repository secret with a
  private topic name and subscribe the [ntfy](https://ntfy.sh) app on the phone
  to that topic. Each new build and update then pings the phone with its link.

### Where the configuration comes from

All client configuration is public `EXPO_PUBLIC_*` values that get inlined into
the JavaScript bundle when it is built. There are no client secrets, so there
are no secret sets to manage, only three value sets:

| Where the bundle is built | Values used | Set in |
| --- | --- | --- |
| your machine (`expo start`, `expo run:*`) | `.env` (gitignored) | edit `.env`, see `.env.example` |
| EAS build or `eas update` for the `preview` profile | `preview` EAS environment | `eas env:set preview --name … --value …` |
| EAS build or `eas update` for the `production` profile | `production` EAS environment | `eas env:set production --name … --value …` |

EAS never sees `.env`: the project upload respects `.gitignore`, and the
`environment` field of each `eas.json` profile picks the server-side variable
set instead. List a set with `eas env:list --environment preview`, or write it
into a local `.env.local` with `eas env:pull --environment preview` when you
want to run against staging on your machine.

The `preview` environment is the **staging app**: `staging.api.almonium.com`,
the staging Stream key, and the `almonium-dev` Firebase project. The Firebase
project matters: the staging backend verifies tokens against `almonium-dev`,
so a build with production Firebase values cannot sign in to staging. The
`production` environment holds the `almonium` Firebase project and
`api.almonium.com`. The Google OAuth client IDs are shared by both, they live in
the production Google Cloud project and the staging Firebase project trusts
them.

Do not rely on the fallback values in `src/config.ts` for a deployed build;
every environment sets the full list explicitly.

Run `Develop to phone` from the Actions tab to trigger it manually; tick
**force build** to rebuild the binaries without a native change. Locally,
`eas build -p android --profile preview` and
`eas update --channel develop --environment preview` do the same thing.

Caveats:

- The preview build still uses the production identifier `com.almonium.mobile`,
  so it replaces a Play-installed Almonium and cannot be installed over one that
  was signed with a different key. Before the first production build is
  installed anywhere, give the staging app its own identity
  (`com.almonium.mobile.staging`, "Almonium Staging") through an
  `APP_VARIANT` switch in an `app.config.js`; see "When to add staging" below.
- Google Sign-In only works when the SHA-1 of the signing keystore is
  registered on the Android app in the `almonium` Firebase project. Read it
  from a build with `apksigner verify --print-certs app.apk`.
- Preview builds keep the remote Android version code, so installing a new
  preview build over the previous one is a plain reinstall.
- iOS ad hoc builds only install on devices registered with
  `eas device:create`; register the device, then trigger a forced build.
- EAS builds are quota-limited on the free plan, updates effectively are not,
  which is why binaries are only rebuilt when the fingerprint changes.

## Phone releases from `main`

Pushing a version tag such as `v1.0.0` to `main` (or running the workflow
manually from the Actions tab) triggers [`.github/workflows/internal-release.yml`](.github/workflows/internal-release.yml).
Ordinary pushes to `main` do not build anything, so store submissions stay a
deliberate act. The workflow runs the checks, creates store-ready Android and
iOS builds on EAS, and submits the finished binaries automatically:

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
| `develop` | staging app: preview build, `https://staging.api.almonium.com`, `almonium-dev` Firebase | EAS Update plus EAS internal distribution, for your own phone |
| `main` | production app and `https://api.almonium.com` | Google Play Internal Testing and TestFlight |

This lets trusted friends test the real production configuration without making
the app public. The `develop` lane is a personal "see today's work on the
phone" lane, not a tester distribution; do not create a staging variant merely
for that purpose.

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

1. The public `EXPO_PUBLIC_*` values (API URL, Stream key, web URL, Google
   client IDs) are set as **Plain text** project variables in the `preview`
   and `production` EAS environments; check them with
   `eas env:list --environment production`. Do not append `/api/v1` to the API
   URL: the mobile client adds that path itself. The tracked public Firebase
   values use their defaults; do not add Firebase Admin keys or provider
   secrets to EAS environment variables.
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

5. Create an Expo access token with access to this EAS project and add it to
   this GitHub repository as the `EXPO_TOKEN` Actions secret. Both workflows
   use it.

The Android submit profile already targets the internal track. EAS increments
the Android version code and iOS build number remotely for every production
build, so each push is acceptable to both stores. TestFlight delivery normally
takes a short Apple processing period; it is not an App Store production
release. Internal TestFlight testing does not require a public App Store
release; inviting external TestFlight testers can require Apple's beta review.
