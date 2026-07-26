# Repository agent guidance

This Expo SDK 54 React Native client is part of the Almonium workspace.

- Read the exact SDK documentation at
  `https://docs.expo.dev/versions/v54.0.0/` before changing Expo behavior.
- `../almonium-be` owns API contracts, Firebase token verification,
  authorization, persistence, and deployment. Read its `AGENTS.md` and auth
  documentation before changing auth or API behavior.
- `../almonium-fe` is the existing Angular client and the reference for current
  product flows and DTOs. Coordinate contract changes across clients.
- `../almonium-infra` owns deployed topology, environment values, and secrets.
  Read its `AGENTS.md` before changing deployment configuration. Never copy
  vault values, production credentials, or Firebase Admin keys here.

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
