// https://docs.expo.dev/guides/using-eslint/
// Guardrail layer from plans/starter-kit.md step 3. Every custom message starts with its rule ID from
// .rules/, so a lint failure names the rule it broke, and a later config block can relax it per folder.
const { defineConfig } = require("eslint/config");
const { readdirSync } = require("node:fs");
const eslintComments = require("@eslint-community/eslint-plugin-eslint-comments");
const expoConfig = require("eslint-config-expo/flat");

// The feature folders drive the import zones below, so a new folder in src/features is guarded
// automatically without touching this file.
const features = readdirSync("src/features").filter((name) => !name.includes("."));

// no-restricted-imports: ban an import in favour of the Expo or package alternative, one entry per ban.
// rn-ui/no-deep-imports: deep react-native paths bypass Metro's module resolution assumptions.
// rn-ui/safe-area-context: RN's SafeAreaView is deprecated; insets belong to react-native-safe-area-context.
// rn-ui/keyboard-controller: react-native-keyboard-controller tracks the keyboard where RN's view does not.
// rn-ui/expo-image: expo-image adds disk caching and placeholders over RN's Image/ImageBackground.
// rn-ui/no-interaction-manager: InteractionManager is deprecated; requestIdleCallback schedules deferred work.
// rn-security/no-async-storage: AsyncStorage is legacy; the MMKV wrapper in @/shared/storage is the app's
//   key-value store, and tokens go through expo-secure-store.
// rn-ui/no-expo-vector-icons: @expo/vector-icons is deprecated; the shared Icon component or expo-symbols.
// rn-testing/no-react-test-renderer: react-test-renderer is deprecated; render through @testing-library/react-native.
// rn-ui/no-manual-memo: React Compiler memoises; useMemo/useCallback/memo add noise that duplicates its work.
const bannedImports = [
  { group: ["react-native/*"], message: "rn-ui/no-deep-imports: import React Native APIs from the 'react-native' root only." },
  { name: "react-native", importNames: ["SafeAreaView"], message: "rn-ui/safe-area-context: import SafeAreaView or useSafeAreaInsets from react-native-safe-area-context." },
  { name: "react-native", importNames: ["KeyboardAvoidingView"], message: "rn-ui/keyboard-controller: import KeyboardAvoidingView from react-native-keyboard-controller." },
  { name: "react-native", importNames: ["Image", "ImageBackground"], message: "rn-ui/expo-image: import Image from expo-image (disk cache, placeholders)." },
  { name: "react-native", importNames: ["InteractionManager"], message: "rn-ui/no-interaction-manager: InteractionManager is deprecated. Schedule deferred work with requestIdleCallback." },
  { name: "react-native", importNames: ["AsyncStorage"], message: "rn-security/no-async-storage: use the MMKV wrapper in @/shared/storage. Tokens go in expo-secure-store." },
  { name: "@react-native-async-storage/async-storage", message: "rn-security/no-async-storage: use the MMKV wrapper in @/shared/storage. Tokens go in expo-secure-store." },
  { name: "@expo/vector-icons", message: "rn-ui/no-expo-vector-icons: @expo/vector-icons is deprecated. Use the Icon component from @/shared/ui or expo-symbols." },
  { group: ["@expo/vector-icons/*"], message: "rn-ui/no-expo-vector-icons: @expo/vector-icons is deprecated. Use the Icon component from @/shared/ui or expo-symbols." },
  { name: "react-test-renderer", message: "rn-testing/no-react-test-renderer: react-test-renderer is deprecated. Render with @testing-library/react-native." },
  { name: "react", importNames: ["useMemo", "useCallback", "memo"], message: "rn-ui/no-manual-memo: React Compiler memoises for you. Write a plain value or function." },
];

// rn-monetization/purchases-in-pro: RevenueCat owns entitlements, so its imports stay inside the pro
// feature and the rest of the app reads entitlements through that feature's public hook.
const purchasesEntry = { name: "react-native-purchases", message: "rn-monetization/purchases-in-pro: import RevenueCat only inside src/features/pro. Read entitlements through its public hook." };

// The rule's schema wants path entries under `paths` and glob entries under `patterns`, so split them.
const isPathEntry = (entry) => "name" in entry;
const restrictedImports = (entries) => ({
  paths: entries.filter((entry) => isPathEntry(entry)),
  patterns: entries.filter((entry) => !isPathEntry(entry)),
});

// no-restricted-syntax: patterns imports cannot express, one entry per selector.
// rn-ui/window-dimensions: Dimensions.get caches the frame at startup; useWindowDimensions() re-renders on rotation.
// rn-security/https-only: cleartext HTTP leaks request data; string and template URLs must be https.
// rn-ui/no-interaction-manager: same ban as the import, for call sites that reach it in any other way.
// rn-ui/no-scrollview-map: an unbounded .map() inside a ScrollView renders everything at once; FlatList recycles.
// rn-ui/font-scaling: allowFontScaling={false} hides text from Dynamic Type users; cap with maxFontSizeMultiplier.
// rn-platform/platform-select: a Platform.OS ternary scatters platform branches; Platform.select keeps them together.
// rn-architecture/store-selectors: a bare Zustand store call subscribes to the whole store and re-renders on every change.
// rn-accessibility/touchable-role: screen readers need a role to announce what a pressable is.
const bannedSyntax = [
  { selector: "CallExpression[callee.object.name='Dimensions'][callee.property.name='get']", message: "rn-ui/window-dimensions: read the window size with useWindowDimensions() inside a component." },
  { selector: "Literal[value=/^http:\\/\\//]", message: "rn-security/https-only: use https:// for every URL." },
  { selector: "TemplateElement[value.raw=/^http:\\/\\//]", message: "rn-security/https-only: use https:// for every URL." },
  { selector: "MemberExpression[object.name='InteractionManager']", message: "rn-ui/no-interaction-manager: InteractionManager is deprecated. Schedule deferred work with requestIdleCallback." },
  { selector: "JSXElement[openingElement.name.name='ScrollView'] CallExpression[callee.property.name='map']", message: "rn-ui/no-scrollview-map: render a list with FlatList instead of mapping inside a ScrollView." },
  { selector: "JSXAttribute[name.name='allowFontScaling'] > JSXExpressionContainer > Literal[value=false]", message: "rn-ui/font-scaling: cap Dynamic Type with maxFontSizeMultiplier instead of turning scaling off." },
  { selector: "ConditionalExpression > BinaryExpression.test > MemberExpression.left[object.name='Platform'][property.name='OS']", message: "rn-platform/platform-select: use Platform.select({ ios, android }) instead of a Platform.OS ternary." },
  { selector: "CallExpression[callee.type='Identifier'][callee.name=/^use[A-Z]\\w*Store$/][arguments.length=0]", message: "rn-architecture/store-selectors: pass a selector, e.g. useNotesStore((s) => s.sort). A bare call re-renders on every store change." },
  { selector: "JSXOpeningElement[name.name=/^(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)$/]:not(:has(JSXAttribute[name.name=/^(accessibilityRole|role)$/])):not(:has(JSXSpreadAttribute))", message: "rn-accessibility/touchable-role: set accessibilityRole on every touchable (button, link, switch...)." },
];

// import/no-restricted-paths: keep imports pointing down from app to features to shared, and keep feature
// internals behind each feature's index.ts (rn-architecture/feature-public-api). The TypeScript resolver is
// configured below, so the @/ aliases resolve for the zone checks.
const dependencyZones = [
  { target: "./src/shared", from: "./src/features", message: "rn-architecture/dependency-direction: shared/ must not import from features/ or app/." },
  { target: "./src/features", from: "./src/app", message: "rn-architecture/dependency-direction: features/ must not import from app/." },
];
const featureZone = (name) => ({
  target: "./src",
  from: `./src/features/${name}`,
  // index.ts is the feature's public API; every other file inside it is internal.
  except: ["./index.ts"],
  message: `rn-architecture/feature-public-api: import @/features/${name} through its index.ts only.`,
});
const featureZones = features.map(featureZone);

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
  {
    // Jest runs this file before every test file, with its globals in scope.
    files: ["jest.setup.js"],
    languageOptions: { globals: { jest: "readonly" } },
  },
  {
    // The config runs in CommonJS, so __dirname — used for tsconfigRootDir below — is defined.
    files: ["eslint.config.js"],
    languageOptions: { globals: { __dirname: "readonly" } },
  },
  {
    settings: {
      "import/resolver": {
        // The TypeScript resolver reads tsconfig paths, so zone targets see through the @/ aliases.
        typescript: { alwaysTryTypes: true, project: ["tsconfig.json"] },
      },
    },
  },
  {
    // App-wide restrictions.
    plugins: { "@eslint-community/eslint-comments": eslintComments },
    rules: {
      // eslint-comments: an eslint-disable must name its rules and say why after `--`, so a silencing
      // agent cannot quietly turn a failing check green without leaving the reason behind.
      "@eslint-community/eslint-comments/require-description": "error",
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "no-restricted-imports": ["error", restrictedImports([...bannedImports, purchasesEntry])],
      "no-restricted-syntax": ["error", ...bannedSyntax],
      // Dependency direction and feature public APIs, checked through the @/ aliases.
      "import/no-restricted-paths": ["error", { zones: [...dependencyZones, ...featureZones] }],
      // rn-ui/stable-list-keys (lintable part): an index key shuffles with reorders, so rows re-render with
      // the wrong content and state; keys must come from the item's identity.
      "react/no-array-index-key": "error",
    },
  },
  {
    // rn-security/no-sensitive-logs (lintable part): console.info/log/debug print on the device log, so
    // only warn and error are allowed here, and whatever they print must carry no secrets, tokens or
    // user data. Scoped to app code; build scripts like design/check.mjs stream to the terminal by design.
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Typed linting: needs the project's type information, so all TS files are checked against tsconfig.json.
    // @typescript-eslint/no-floating-promises enforces rn-testing/await-rntl: RNTL 14's render and fireEvent
    // return promises, so an unawaited call races the component tree and the assertions behind it.
    // The no-unsafe-* rules block `any` values from crossing into or out of app code.
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
    },
  },
  {
    // rn-monetization/purchases-in-pro: the pro feature is the one folder allowed to import RevenueCat;
    // a later config block replaces the whole rule config, hence the shared array.
    files: ["src/features/pro/**"],
    rules: {
      "no-restricted-imports": ["error", restrictedImports(bannedImports)],
    },
  },
  ...features.map((name) => ({
    // Files inside a feature import their siblings relatively, so they are exempt from their own
    // feature's public-API zone; every other zone, including the other features', still applies.
    files: [`src/features/${name}/**`],
    rules: {
      "import/no-restricted-paths": [
        "error",
        { zones: [...dependencyZones, ...featureZones.filter((zone) => zone.from !== `./src/features/${name}`)] },
      ],
    },
  })),
]);