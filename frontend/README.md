# Iryo mobile app

Expo (SDK 57), React Native, TypeScript, Expo Router.

```bash
cp .env.example .env    # set EXPO_PUBLIC_API_URL to your backend address
npm install
npx expo start --tunnel # open the exp:// link in Expo Go
npm run typecheck       # type check
```

## Folders
- `src/app`: screens. `(auth)` login and signup, `(tabs)` dashboard, device, profile.
- `src/components`: `ui` (cards, buttons, fields), `art` (characters, door intro), `dashboard`, `device`.
- `src/services`: API client, session storage, sound and haptics, server wake-up check.
- `src/hooks`, `src/context`, `src/theme`, `src/utils`, `src/types`.

## Hosted server asleep?
Free hosting sleeps when idle. On open the app checks `/api/health` every 5 seconds, shows "Waking up the server", and keeps it warm while open. The numbers are in `src/services/serverStatus.ts`.

Appearance, sound and animation settings are saved on the phone only and never sent to the backend.
