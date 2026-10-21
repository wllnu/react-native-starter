const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Drizzle migrations are .sql files inlined by babel (see babel.config.js).
config.resolver.sourceExts.push("sql");

module.exports = config;
