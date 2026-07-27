# Repository agent guidance

This Expo SDK 54 React Native client is part of the Almonium workspace.

- Read the exact SDK documentation at
  `https://docs.expo.dev/versions/v54.0.0/` before changing Expo behavior.
- `../almonium-be` owns API contracts, Firebase token verification,
  authorization, persistence, and deployment. Read its `AGENTS.md` and auth
  documentation before changing auth or API behavior.
- `../almonium-fe` is the existing Angular client and the reference for current
  product flows and DTOs. Coordinate contract changes across clients.
- `../almonium-infra` owns the deployed server topology and the FE/BE container
  deployment path. This mobile app is a native Expo client distributed through
  Expo/EAS and app stores, not an infra-hosted container; coordinate any future
  mobile release automation with infra without moving mobile secrets there. Read
  its `AGENTS.md` before changing deployment configuration. Never copy vault
  values, production credentials, or Firebase Admin keys here.

Keep public Expo configuration in `EXPO_PUBLIC_*` variables and document new
keys in `.env.example`. Public Firebase client identifiers are allowed;
provider secrets and service-account material are not.

Use Firebase ID-token bearer authentication for API calls. Do not persist
backend cookies or implement a second token format. Preserve the backend's
ownership and authorization checks.

Finish each verified implementation iteration with a Git commit. Review the
diff, preserve unrelated changes, and commit both `package.json` and
`package-lock.json` for dependency changes.

Run `npm run check` before committing. For navigation/native configuration
changes, also run an Expo export or launch the relevant development build when
the host toolchain is available.

## Visual system

- Treat `docs/Almonium design system analysis.md` as the visual source of
  truth and consult `../almonium-fe` for shipped examples before introducing
  or changing UI patterns.
- Use semantic values from `src/theme.ts`; do not add screen-local brand
  colours. New brand tokens must be justified against the analysis and added
  centrally.
- Preserve the core identity: `#F9F6F5` paper-warm page ground, pure-white
  raised surfaces, charcoal text, plum/aubergine brand accents, and the
  plum-to-raspberry gradient for the primary commit action. Green is only a
  semantic success state, never a general accent.
- Pair serif display/entity titles with sans-serif controls and body copy.
  Prefer medium/semibold weights over heavy black UI typography.
- Use very round geometry: pill buttons and inputs, 20px content panels, and
  roughly 24-35px raised cards. A raised surface uses shadow without a border;
  a flat interactive surface may use a 1px warm-grey or semantic border.
- Use colour to communicate data or state, not as decoration. Orange is for
  reading metadata/progress; pink is danger; green is success; cyan-violet is
  premium. Keep ordinary screens to one cream ground, one white surface tier,
  and one primary gradient action.
- Adapt desktop compositions to native ergonomics instead of reproducing them
  literally: retain native bottom tabs, safe areas, platform controls, 44px
  minimum touch targets, readable insets, and single-column phone layouts.
- Before committing a visual change, inspect all affected states (loading,
  empty, error, disabled, pressed, and dark reader mode where relevant) and run
  `npm run check`.
