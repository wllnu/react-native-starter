---
id: rn-security
title: React Native security
paths: **/*.ts, **/*.tsx
when: The change touches secrets, tokens, authentication, storage, logging, network URLs, deep links, or WebViews.
---

## rn-security/no-client-secrets
Severity: error
Rule: Keep secret keys out of app code and `EXPO_PUBLIC_` variables.
Violated when: the changed lines contain a hard-coded secret key or password literal, or read an `EXPO_PUBLIC_` variable whose name contains `SECRET`, `PRIVATE`, `PASSWORD`, `SERVICE_ROLE`, or names a third-party secret such as `OPENAI_API_KEY`.
Followed when: `EXPO_PUBLIC_` variables in the changed lines hold only public config such as an API URL or a publishable key, and no secret literal appears.

Good:
```ts
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

Bad:
```ts
const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
```

## rn-security/secure-token-storage
Severity: error
Rule: Store tokens, passwords, API secrets and private keys only in the Keychain through `expo-secure-store`.
Violated when: a token, password, secret or private key is written with AsyncStorage, MMKV, `expo-sqlite/kv-store` or a SQLite insert.
Followed when: every write of a token, password, secret or private key in the changed lines calls `SecureStore.setItemAsync(` or `SecureStore.setItem(`.

Good:
```ts
await SecureStore.setItemAsync("refreshToken", refreshToken);
```

Bad:
```ts
storage.set("refreshToken", refreshToken);
```

## rn-security/no-async-storage
Severity: warning
Rule: Do not use AsyncStorage in new code.
Violated when: an import path is `@react-native-async-storage/async-storage`, or `AsyncStorage` is imported from `react-native`.
Followed when: key-value reads and writes in the changed lines go through the app's storage wrapper and no AsyncStorage import appears.

Good:
```ts
import { storage } from "@/shared/storage";
```

Bad:
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
```

## rn-security/no-sensitive-logs
Severity: error
Rule: Never log passwords, tokens, authorization headers, card data or private user records.
Violated when: a `console.` call, a `logger.` call or a monitoring breadcrumb receives a password, a token, request headers, card data, or a whole user or message record.
Followed when: log and breadcrumb calls in the changed lines pass only identifiers, counts, statuses and error kinds.

Good:
```ts
logger.info("session refreshed", { userId: session.userId });
```

Bad:
```ts
logger.info("session refreshed", { refreshToken: session.refreshToken });
```

## rn-security/https-only
Severity: error
Rule: Use HTTPS for every network URL.
Violated when: a string literal in the changed lines starts with `http://`.
Followed when: every URL literal in the changed lines starts with `https://`.

Good:
```ts
const fallbackApiUrl = "https://api.example.com";
```

Bad:
```ts
const fallbackApiUrl = "http://api.example.com";
```

## rn-security/no-tokens-in-links
Severity: warning
Rule: Keep tokens out of deep-link and route URLs.
Violated when: a token is placed in the path or query of a URL passed to `router.push(`, `router.replace(`, `Linking.createURL(` or `Linking.openURL(`.
Followed when: URLs built in the changed lines carry only identifiers and no access, refresh or session token.

Good:
```ts
router.push(`/invites/${inviteId}`);
```

Bad:
```ts
router.push(`/invites/${inviteId}?token=${accessToken}`);
```

## rn-security/oauth-pkce
Severity: error
Rule: Run OAuth as the authorization code flow with PKCE.
Violated when: an auth request sets `usePKCE: false` or `responseType: ResponseType.Token`.
Followed when: auth requests in the changed lines use `ResponseType.Code` or the default response type and leave `usePKCE` on.

Good:
```ts
const [request, , promptAsync] = useAuthRequest(
  { clientId, redirectUri, responseType: ResponseType.Code },
  discovery,
);
```

Bad:
```ts
const [request, , promptAsync] = useAuthRequest(
  { clientId, redirectUri, responseType: ResponseType.Token, usePKCE: false },
  discovery,
);
```

## rn-security/universal-link-auth-callback
Severity: warning
Rule: Use a universal link, not a custom URL scheme, for auth callbacks.
Violated when: an OAuth `redirectUri` is built with `makeRedirectUri({ scheme:` or is a literal with a custom scheme such as `myapp://`.
Followed when: every `redirectUri` in the changed lines is an `https://` URL.

Good:
```ts
const redirectUri = "https://example.com/auth/callback";
```

Bad:
```ts
const redirectUri = "myapp://auth/callback";
```

## rn-security/no-webview-token-injection
Severity: error
Rule: Never inject a token into a WebView.
Violated when: a token is interpolated into `injectedJavaScript`, `injectedJavaScriptBeforeContentLoaded`, or a call to `injectJavaScript(` or the WebView's `postMessage(`.
Followed when: scripts and messages sent to a WebView in the changed lines contain no access, refresh or session token.

Good:
```tsx
<WebView source={{ uri: helpUrl }} injectedJavaScript={`window.appTheme = "${scheme}";`} />
```

Bad:
```tsx
<WebView source={{ uri: helpUrl }} injectedJavaScript={`window.token = "${accessToken}";`} />
```
