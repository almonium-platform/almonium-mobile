# Store release

What stands between `develop` and a listed app, and the answers the two consoles
ask for. The code side is done unless a row below says otherwise; the rest is
console work that only the account owner can do.

## Release path

- Store builds come from `.github/workflows/internal-release.yml`: push a `v*`
  tag or run it by hand. It runs `eas build --platform all --profile production
  --auto-submit`, which needs the submit credentials below to be on EAS.
- The `production` EAS environment holds `api.almonium.com`, the production
  Stream key and the production Google client ids. Firebase falls back to the
  `almonium` project defaults in `src/config.ts`.
- `EXPO_PUBLIC_EXTERNAL_PURCHASE_LINKS` stays unset for store builds: the app
  then shows what membership adds without prices or a way to buy. See the
  comment in `src/config.ts`.

## Before the first build

| | Where | Status |
|---|---|---|
| App Store Connect app record for `com.almonium.mobile` | ASC → My Apps | needed; `eas submit` can create it from the ASC API key |
| ASC API key on EAS for `--auto-submit` | `eas credentials -p ios` → App Store Connect API Key (key `9J9BXRQX7T`, see the iOS credentials memory) | check |
| Google Play app for `com.almonium.mobile` | Play Console → Create app | needed |
| Play service account JSON on EAS for `--auto-submit` | Play Console → Users and permissions → invite the service account; `eas credentials -p android` → Google Service Account | needed |
| Play closed-test rule | if the developer account is a personal one created after Nov 2023, production needs a 14-day closed test with 12 opted-in testers first | check account type |
| Review account | a production account with a few saved words, one book in progress and a chat; put email + password in the review notes | needed |
| Google Sign-In SHA-1 for the production keystore | same EAS keystore as preview, so the SHA-1 already on the `almonium` Firebase Android app covers it | done |
| Universal links | `almonium.com/.well-known/apple-app-site-association` and `assetlinks.json` are not served yet; links still open the web until they are. Not a review blocker. | infra/FE |

## Listing

- **Name:** Almonium
- **Subtitle / short description (30 / 80 chars):** Read anything. Keep every word.
- **Category:** Education (secondary: Books)
- **Description:**

  Almonium is for people who already read in the language they are learning
  and want to keep what they meet. Open a book from the library, tap a word
  or a sentence, see it explained in context, and save it with the sentence
  it came from. Read a parallel translation on demand or inline. Your saved
  words come back for review at the rhythm you set, across every language
  you learn. Read without an account; sign in when you want to keep things.

  Almonium is not a beginner course and it does not gamify. It is a reader
  and a memory for words, built for self-directed intermediate and advanced
  learners.

- **Keywords (iOS, 100 chars):** language,reading,vocabulary,german,spanish,french,flashcards,parallel text,books,learn
- **Support URL:** https://almonium.com (support@almonium.com is in the app under Legal → Contact us)
- **Marketing URL:** https://almonium.com
- **Privacy policy URL:** https://almonium.com/privacy-policy
- **Terms:** https://almonium.com/terms-of-use (Apple's standard EULA is fine)
- **Age rating:** 4+ / Everyone. User-generated content: yes, with report and block in the app. No ads, no in-app purchases.
- **Screenshots:** 6.9" and 6.5" iPhone; Android phone. No iPad set, `supportsTablet` is off for 1.0.

## Privacy answers

What the app sends and to whom; the same answers fill Apple's App Privacy and
Google's Data safety.

| Data | Collected | Linked to the user | Purpose | Where it goes |
|---|---|---|---|---|
| Email address, name, user id | yes | yes | account | Firebase Auth, Almonium API |
| Saved words, reading positions, learning settings | yes | yes | app functionality | Almonium API |
| Messages and channel posts | yes | yes | app functionality | Stream Chat |
| Notifications | local reminders only, scheduled on the device; no push tokens | — | — | nowhere |
| Crash, analytics, advertising identifiers | none; no analytics or ads SDK is installed | — | — | — |

- Data is encrypted in transit (HTTPS). Users can delete their account in the
  app (Settings → Account, typed confirmation) and export their words as CSV.
- Android permissions in the build: `INTERNET`, `ACCESS_NETWORK_STATE`,
  `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK` and
  launcher badge permissions from expo-notifications. Storage and
  `SYSTEM_ALERT_WINDOW` are blocked in `app.json`. Nothing here needs a
  permissions declaration form.
- iOS: `ITSAppUsesNonExemptEncryption` is false; no purpose strings are needed
  because no camera, photos, location or microphone are used.

## Review notes to paste

Almonium is a reading and vocabulary app. Reading the public library needs no
account. Sign in with the review account below to save words, chat and see
settings. Membership cannot be bought in the app; the app only recognises a
membership that exists on the account. Readers can report a message
(long-press → Report) or a profile (Report reader) and block a profile; reports
reach our moderation queue.
