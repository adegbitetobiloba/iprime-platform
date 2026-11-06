// Owner: Account 1. Needs eslint-config-expo and eslint-config-prettier (installed by bootstrap.sh).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([expoConfig, prettier, { ignores: ['dist/*', '.expo/*'] }]);
