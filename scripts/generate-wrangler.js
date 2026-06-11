#!/usr/bin/env node

const { existsSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envFile = path.join(rootDir, '.env');

function parseEnv(content) {
  return content.split(/\r?\n/).reduce((result, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return result;

    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex === -1) return result;

    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();
    if (!key) return result;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
    return result;
  }, {});
}

function loadEnv() {
  const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
  return { ...fileEnv, ...process.env };
}

function getEnv(env, key, fallback) {
  return env[key] == null || env[key] === '' ? fallback : env[key];
}

function parseBool(value, fallback) {
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function parseList(value) {
  if (value == null || value === '') return [];
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function tomlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function tomlArray(values) {
  return `[${values.map(tomlString).join(', ')}]`;
}

function renderWranglerToml(env) {
  const name = getEnv(env, 'WRANGLER_NAME', 'conf-inject-script');
  const main = getEnv(env, 'WRANGLER_MAIN', 'src/index.js');
  const compatibilityDate = getEnv(env, 'WRANGLER_COMPATIBILITY_DATE', '2023-09-04');
  const compatibilityFlags = parseList(getEnv(env, 'WRANGLER_COMPATIBILITY_FLAGS', ''));
  const keepVars = parseBool(getEnv(env, 'WRANGLER_KEEP_VARS', 'true'), true);

  const assetsDirectory = getEnv(env, 'ASSETS_DIRECTORY', '');
  const assetsBinding = getEnv(env, 'ASSETS_BINDING', 'ASSETS');
  const observabilityEnabled = parseBool(getEnv(env, 'OBSERVABILITY_ENABLED', 'true'), true);

  const d1DatabaseId = getEnv(env, 'D1_DATABASE_ID', '');
  const d1DatabaseName = getEnv(env, 'D1_DATABASE_NAME', 'app_db');
  const d1Binding = getEnv(env, 'D1_BINDING', 'DB');

  const kvNamespaceId = getEnv(env, 'KV_NAMESPACE_ID', 'YOUR_KV_NAMESPACE_ID');
  const kvBinding = getEnv(env, 'KV_BINDING', 'CONFIG_KV');

  let toml = '';
  toml += `name = ${tomlString(name)}\n`;
  toml += `main = ${tomlString(main)}\n`;
  toml += `compatibility_date = ${tomlString(compatibilityDate)}\n`;

  if (compatibilityFlags.length > 0) {
    toml += `compatibility_flags = ${tomlArray(compatibilityFlags)}\n`;
  }

  toml += `\nkeep_vars = ${keepVars ? 'true' : 'false'}\n`;

  toml += '\n# 本地开发环境变量（用于开发测试）\n';
  toml += '[vars]\n';
  toml += `ACCESS_TOKEN = ${tomlString(getEnv(env, 'ACCESS_TOKEN', 'your_secret_token'))}\n`;
  toml += `ADMIN_TOKEN = ${tomlString(getEnv(env, 'ADMIN_TOKEN', 'your_admin_token'))}\n`;
  toml += `TELEGRAM_BOT_TOKEN = ${tomlString(getEnv(env, 'TELEGRAM_BOT_TOKEN', ''))}\n`;
  toml += `TELEGRAM_CHAT_ID = ${tomlString(getEnv(env, 'TELEGRAM_CHAT_ID', ''))}\n`;

  toml += '\n[triggers]\n';
  toml += 'crons = []\n';

  if (assetsDirectory) {
    toml += '\n# Assets binding (generated)\n';
    toml += '[assets]\n';
    toml += `binding = ${tomlString(assetsBinding)}\n`;
    toml += `directory = ${tomlString(assetsDirectory)}\n`;
  }

  if (observabilityEnabled) {
    toml += '\n[observability]\n';
    toml += 'enabled = true\n';
  }

  if (d1DatabaseId) {
    toml += '\n# D1 binding (generated)\n';
    toml += '[[d1_databases]]\n';
    toml += `binding = ${tomlString(d1Binding)}\n`;
    toml += `database_name = ${tomlString(d1DatabaseName)}\n`;
    toml += `database_id = ${tomlString(d1DatabaseId)}\n`;
  }

  if (kvNamespaceId) {
    toml += '\n# KV binding (generated)\n';
    toml += '[[kv_namespaces]]\n';
    toml += `binding = ${tomlString(kvBinding)}\n`;
    toml += `id = ${tomlString(kvNamespaceId)}\n`;
  }

  return { toml, kvNamespaceId };
}

function main() {
  const env = loadEnv();
  const outputFile = getEnv(env, 'WRANGLER_OUTPUT_FILE', 'wrangler.toml');
  const outputPath = path.resolve(rootDir, outputFile);
  const { toml, kvNamespaceId } = renderWranglerToml(env);

  try {
    writeFileSync(outputPath, toml, 'utf8');
    console.log(`wrangler.toml generated at ${path.relative(rootDir, outputPath)}`);

    if (kvNamespaceId === 'YOUR_KV_NAMESPACE_ID') {
      console.warn('Warning: KV_NAMESPACE_ID is not set. Replace YOUR_KV_NAMESPACE_ID before deploying.');
    }
  } catch (error) {
    console.error('Failed to generate wrangler.toml:', error.message);
    process.exit(1);
  }
}

main();
