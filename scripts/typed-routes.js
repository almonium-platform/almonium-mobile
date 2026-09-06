#!/usr/bin/env node
/* global __dirname */
// Regenerates .expo/types/router.d.ts without a running dev server, so `tsc` sees new routes.
const path = require('node:path');
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(__dirname, '../app');
const { regenerateDeclarations } = require('expo-router/build/typed-routes');
regenerateDeclarations(path.resolve(__dirname, '../.expo/types'));
setTimeout(() => undefined, 600);
