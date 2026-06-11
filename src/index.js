/**
 * Cloudflare Worker脚本 - QuantumultX配置注入
 * 用于在QuantumultX的conf配置文件中注入自定义内容
 */

import { mergeConfBySectionRegex } from '../utils/platform-conf-parser.js';

const SUPPORTED_PLATFORMS = [
  { key: 'quantumultx', value: 'QuantumultX', label: 'QuantumultX', aliases: ['quanx'] },
  { key: 'loon', value: 'Loon', label: 'Loon', aliases: [] }
];

function normalizePlatformKey(platform) {
  const normalized = String(platform ?? '').trim().toLowerCase();
  const item = SUPPORTED_PLATFORMS.find(platformItem =>
    platformItem.aliases.includes(normalized) ||
    platformItem.key === normalized ||
    platformItem.value.toLowerCase() === normalized
  );
  return item?.key || null;
}

function normalizePlatformName(platform) {
  const key = normalizePlatformKey(platform);
  return SUPPORTED_PLATFORMS.find(item => item.key === key)?.value || null;
}

function normalizePlatformStoredValue(platform) {
  const key = normalizePlatformKey(platform);
  return SUPPORTED_PLATFORMS.find(item => item.key === key)?.value.toLowerCase() || null;
}

function getPlatformAliases(platformKey) {
  const item = SUPPORTED_PLATFORMS.find(item => item.key === platformKey);
  return item ? Array.from(new Set([item.value.toLowerCase(), ...item.aliases])) : [];
}

function getSupportedPlatformText() {
  return SUPPORTED_PLATFORMS.map(item => item.label).join('、');
}

function formatPlatformName(platform) {
  const normalizedName = normalizePlatformName(platform);
  return SUPPORTED_PLATFORMS.find(item => item.value === normalizedName)?.label || platform;
}

/**
 * 在原始配置文件中注入自定义内容
 * @param {string} originalConfig 原始配置文件内容
 * @param {Object} injectConfigs 注入配置对象
 * @returns {string} 注入后的配置文件内容
 */
function injectConfigToOriginal(originalConfig, injectConfigText, platform) {
  return mergeConfBySectionRegex(originalConfig, injectConfigText, platform);
}

const KV_KEY_PLATFORMS = 'platform_injections';
const KV_KEY_SOURCES = 'source_configs';

function getConfigKV(env) {
  return env.CONFIG_KV || env.KV || null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getNextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

async function readKVList(env, key) {
  const kv = getConfigKV(env);
  if (!kv) return null;
  const data = await kv.get(key, { type: 'json' });
  return Array.isArray(data) ? data : [];
}

async function writeKVList(env, key, items) {
  const kv = getConfigKV(env);
  if (!kv) return false;
  await kv.put(key, JSON.stringify(items));
  return true;
}

async function sendTelegramMessage(env, text) {
  const botToken = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(env.TELEGRAM_CHAT_ID || '').trim();
  if (!botToken || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    if (!response.ok) {
      console.error('发送 Telegram 通知失败:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('发送 Telegram 通知失败:', error);
  }
}

function notifyTelegram(ctx, env, text) {
  const promise = sendTelegramMessage(env, text);
  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
  }
}

function maskToken(token) {
  const tokenText = String(token ?? '');
  if (!tokenText) return '';
  if (tokenText.length <= 4) return '*'.repeat(tokenText.length);
  if (tokenText.length <= 8) return `${tokenText.slice(0, 2)}${'*'.repeat(tokenText.length - 4)}${tokenText.slice(-2)}`;
  return `${tokenText.slice(0, 3)}${'*'.repeat(tokenText.length - 6)}${tokenText.slice(-3)}`;
}

function formatAccessNotification({ platform, sourceUrl, token }) {
  return [
    '#通知服务 #配置注入脚本',
    '',
    '有新的请求',
    '',
    `平台: ${formatPlatformName(platform)}`,
    `源文件: ${sourceUrl}`,
    `Token: ${maskToken(token)}`
  ].join('\n');
}

async function getPlatformList(env) {
  const items = await readKVList(env, KV_KEY_PLATFORMS);
  return items?.sort((a, b) => String(a.platform).localeCompare(String(b.platform))) || null;
}

async function savePlatformList(env, items) {
  return writeKVList(env, KV_KEY_PLATFORMS, items);
}

async function getSourceList(env, enabledOnly = false) {
  const items = await readKVList(env, KV_KEY_SOURCES);
  if (!items) return null;
  return items
    .filter(item => !enabledOnly || (item.enabled !== false && item.enabled !== 0))
    .sort((a, b) => {
      const platformCompare = String(a.platform).localeCompare(String(b.platform));
      if (platformCompare !== 0) return platformCompare;
      return String(a.author).localeCompare(String(b.author));
    });
}

async function saveSourceList(env, items) {
  return writeKVList(env, KV_KEY_SOURCES, items);
}

/**
 * 从KV获取平台注入配置内容
 */
async function getPlatformInjectionFromKV(env, platform) {
  const aliases = getPlatformAliases(platform);
  if (!aliases.length) return null;
  try {
    const items = await getPlatformList(env);
    if (!items) return null;
    const preferredPlatform = normalizePlatformStoredValue(platform);
    return items.find(item => String(item.platform).toLowerCase() === preferredPlatform) ||
      items.find(item => aliases.includes(String(item.platform).toLowerCase())) ||
      null;
  } catch (e) {
    console.error('读取平台配置KV失败:', e);
    return null;
  }
}

/**
 * 从KV获取启用的配置源列表
 */
async function getSourcesFromKV(env) {
  try {
    return await getSourceList(env, true);
  } catch (e) {
    console.error('读取配置源KV失败:', e);
    return null;
  }
}

/**
 * 处理管理后台页面
 */
function handleAdminPage(request, env) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN" class="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>配置注入脚本 - 管理后台</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            border: "hsl(214.3 31.8% 91.4%)",
            input: "hsl(214.3 31.8% 91.4%)",
            ring: "hsl(221.2 83.2% 53.3%)",
            background: "hsl(0 0% 100%)",
            foreground: "hsl(222.2 84% 4.9%)",
            primary: {
              DEFAULT: "hsl(221.2 83.2% 53.3%)",
              foreground: "hsl(210 40% 98%)",
            },
            secondary: {
              DEFAULT: "hsl(210 40% 96.1%)",
              foreground: "hsl(222.2 47.4% 11.2%)",
            },
            destructive: {
              DEFAULT: "hsl(0 84.2% 60.2%)",
              foreground: "hsl(210 40% 98%)",
            },
            muted: {
              DEFAULT: "hsl(210 40% 96.1%)",
              foreground: "hsl(215.4 16.3% 46.9%)",
            },
            accent: {
              DEFAULT: "hsl(210 40% 96.1%)",
              foreground: "hsl(222.2 47.4% 11.2%)",
            },
            popover: {
              DEFAULT: "hsl(0 0% 100%)",
              foreground: "hsl(222.2 84% 4.9%)",
            },
            card: {
              DEFAULT: "hsl(0 0% 100%)",
              foreground: "hsl(222.2 84% 4.9%)",
            },
          },
          borderRadius: {
            lg: "0.5rem",
            md: "calc(0.5rem - 2px)",
            sm: "calc(0.5rem - 4px)",
          },
        },
      },
    }
  </script>
  <style>
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body class="bg-slate-50 min-h-screen">
  <!-- 登录表单 -->
  <div id="loginForm" class="flex items-center justify-center min-h-screen">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <h1 class="text-2xl font-semibold text-center text-slate-900 mb-6">管理后台登录</h1>
        <div id="loginError" class="hidden mb-4 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md"></div>
        <form onsubmit="login(event)" class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">管理令牌</label>
            <input type="password" id="token" required placeholder="请输入管理令牌" 
              class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
          <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200">
            登录
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- 主内容区 -->
  <div id="mainContent" class="hidden">
    <!-- Header -->
    <div class="bg-white border-b border-slate-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <h1 class="text-xl font-semibold text-slate-900">配置注入脚本 - 管理后台</h1>
          <button onclick="logout()" class="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors duration-200">
            退出登录
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div id="message" class="hidden mb-4"></div>
      
      <!-- Tabs -->
      <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div class="border-b border-slate-200">
          <nav class="flex space-x-8 px-6" aria-label="Tabs">
            <button class="tab border-b-2 border-blue-500 py-4 px-1 text-sm font-medium text-blue-600" onclick="switchTab('platforms')">
              平台配置管理
            </button>
            <button class="tab border-b-2 border-transparent py-4 px-1 text-sm font-medium text-slate-500 hover:text-slate-700 hover:border-slate-300" onclick="switchTab('sources')">
              配置源管理
            </button>
          </nav>
        </div>

        <!-- 平台管理 -->
        <div id="platforms" class="tab-content active p-6">
          <div class="mb-4">
            <button id="addPlatformButton" onclick="openModal('platform')" class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              新增平台
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full table-fixed divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr>
                  <th class="w-32 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">平台</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">配置内容</th>
                  <th class="w-40 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody id="platformsTable" class="bg-white divide-y divide-slate-200"></tbody>
            </table>
          </div>
        </div>

        <!-- 配置源管理 -->
        <div id="sources" class="tab-content p-6">
          <div class="mb-4">
            <button onclick="openModal('source')" class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              新增配置源
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">平台</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">作者</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
                  <th class="w-64 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody id="sourcesTable" class="bg-white divide-y divide-slate-200"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 模态框 -->
  <div id="modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between p-6 border-b border-slate-200">
        <h2 id="modalTitle" class="text-lg font-semibold text-slate-900"></h2>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <form id="modalForm" onsubmit="submitForm(event)">
        <input type="hidden" id="formType">
        <input type="hidden" id="formId">
        <div id="formFields" class="p-6 space-y-4"></div>
        <div class="flex gap-3 px-6 pb-6">
          <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200">
            保存
          </button>
          <button type="button" onclick="closeModal()" class="flex-1 bg-white border border-slate-300 text-slate-700 font-medium py-2 px-4 rounded-md hover:bg-slate-50 transition-colors duration-200">
            取消
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let token = '';
    let platformsData = [];
    let sourcesData = [];
    const supportedPlatforms = ${JSON.stringify(SUPPORTED_PLATFORMS)};

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[ch]));
    }

    function normalizePlatformValue(value) {
      const normalized = String(value ?? '').trim().toLowerCase();
      const item = supportedPlatforms.find(platform =>
        platform.aliases.includes(normalized) || platform.key === normalized || platform.value.toLowerCase() === normalized
      );
      return item?.value || '';
    }

    function formatPlatformName(value) {
      const officialValue = normalizePlatformValue(value);
      return supportedPlatforms.find(platform => platform.value === officialValue)?.label || value;
    }

    function getConfiguredPlatformValues(excludedId = '') {
      const excludedIdText = String(excludedId || '');
      return new Set(platformsData
        .filter(item => String(item.id || '') !== excludedIdText)
        .map(item => normalizePlatformValue(item.platform))
        .filter(Boolean)
      );
    }

    function getSelectablePlatforms(selectedValue, excludedId = '') {
      const configuredPlatformValues = getConfiguredPlatformValues(excludedId);
      const officialValue = normalizePlatformValue(selectedValue);
      return supportedPlatforms.filter(platform =>
        platform.value === officialValue || !configuredPlatformValues.has(platform.value)
      );
    }

    function updateAddPlatformButton() {
      const button = document.getElementById('addPlatformButton');
      if (!button) return;
      const hasAvailablePlatform = getSelectablePlatforms().length > 0;
      button.disabled = !hasAvailablePlatform;
      button.title = hasAvailablePlatform ? '' : '所有支持的平台均已配置';
    }

    function renderPlatformOptions(platformItems, selectedValue) {
      const officialValue = normalizePlatformValue(selectedValue);
      return [
        '<option value="" disabled ' + (officialValue ? '' : 'selected') + '>请选择平台</option>',
        ...platformItems.map(platform =>
          '<option value="' + escapeHtml(platform.value) + '" ' + (platform.value === officialValue ? 'selected' : '') + '>' + escapeHtml(platform.label) + '</option>'
        )
      ].join('');
    }

    function renderPlatformConfigOptions(selectedValue, excludedId = '') {
      return renderPlatformOptions(getSelectablePlatforms(selectedValue, excludedId), selectedValue);
    }

    function renderAllPlatformOptions(selectedValue) {
      return renderPlatformOptions(supportedPlatforms, selectedValue);
    }

    // 登录
    async function login(e) {
      e.preventDefault();
      const inputToken = document.getElementById('token').value;
      const res = await fetch('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inputToken })
      });
      if (res.ok) {
        token = inputToken;
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        loadData();
      } else {
        const errorEl = document.getElementById('loginError');
        errorEl.textContent = '令牌无效';
        errorEl.classList.remove('hidden');
      }
    }

    // 退出登录
    function logout() {
      token = '';
      document.getElementById('loginForm').classList.remove('hidden');
      document.getElementById('mainContent').classList.add('hidden');
      document.getElementById('token').value = '';
    }

    // 切换标签
    function switchTab(tab) {
      const tabs = document.querySelectorAll('.tab');
      const contents = document.querySelectorAll('.tab-content');
      
      tabs.forEach(t => {
        t.classList.remove('border-blue-500', 'text-blue-600');
        t.classList.add('border-transparent', 'text-slate-500');
      });
      contents.forEach(c => c.classList.remove('active'));
      
      event.target.classList.remove('border-transparent', 'text-slate-500');
      event.target.classList.add('border-blue-500', 'text-blue-600');
      document.getElementById(tab).classList.add('active');
    }

    // 加载数据
    async function loadData() {
      await loadPlatforms();
      await loadSources();
    }

    // 加载平台列表
    async function loadPlatforms() {
      const res = await fetch('/admin/api/platforms', {
        headers: { 'Authorization': token }
      });
      const data = await res.json();
      platformsData = data;
      const tbody = document.getElementById('platformsTable');
      tbody.innerHTML = data.map(p => \`
        <tr class="hover:bg-slate-50">
          <td class="w-32 px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">\${escapeHtml(formatPlatformName(p.platform))}</td>
          <td class="min-w-0 px-6 py-4 text-sm text-slate-500">
            <pre class="block w-full max-w-full max-h-32 overflow-hidden whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">\${escapeHtml(p.content || '')}</pre>
          </td>
          <td class="w-40 px-6 py-4 whitespace-nowrap text-sm font-medium">
            <div class="flex gap-2">
              <button onclick="editPlatformById(\${p.id})" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
                编辑
              </button>
              <button onclick="deletePlatform(\${p.id})" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors">
                删除
              </button>
            </div>
          </td>
        </tr>
      \`).join('');
      updateAddPlatformButton();
    }

    // 加载配置源列表
    async function loadSources() {
      const res = await fetch('/admin/api/sources', {
        headers: { 'Authorization': token }
      });
      const data = await res.json();
      sourcesData = data;
      const tbody = document.getElementById('sourcesTable');
      tbody.innerHTML = data.map(s => \`
        <tr class="hover:bg-slate-50">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">\${escapeHtml(formatPlatformName(s.platform))}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">\${escapeHtml(s.author)}</td>
          <td class="px-6 py-4 text-sm text-slate-500 break-all">\${escapeHtml(s.url)}</td>
          <td class="w-64 px-6 py-4 whitespace-nowrap text-sm font-medium">
            <div class="flex gap-2">
              <button onclick="copySourceAccessLink(\${s.id})" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors">
                复制链接
              </button>
              <button onclick="editSourceById(\${s.id})" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
                编辑
              </button>
              <button onclick="deleteSource(\${s.id})" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors">
                删除
              </button>
            </div>
          </td>
        </tr>
      \`).join('');
    }

    // 打开模态框
    function openModal(type, data = {}) {
      if (type === 'platform' && !data.id && getSelectablePlatforms().length === 0) {
        showMessage('所有支持的平台均已配置', 'error');
        return;
      }

      document.getElementById('formType').value = type;
      document.getElementById('formId').value = data.id || '';
      
      if (type === 'platform') {
        document.getElementById('modalTitle').textContent = data.id ? '编辑平台' : '新增平台';
        document.getElementById('formFields').innerHTML = \`
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">平台 *</label>
            <select id="platform" required class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              \${renderPlatformConfigOptions(data.platform, data.id)}
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">配置内容 *</label>
            <textarea id="content" required rows="18" spellcheck="false" placeholder="粘贴该平台需要注入的配置内容" class="w-full px-3 py-2 text-xs font-mono leading-relaxed border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">\${escapeHtml(data.content || '')}</textarea>
          </div>
        \`;
      } else {
        document.getElementById('modalTitle').textContent = data.id ? '编辑配置源' : '新增配置源';
        document.getElementById('formFields').innerHTML = \`
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">平台 *</label>
            <select id="platform" required class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              \${renderAllPlatformOptions(data.platform)}
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">作者名称 *</label>
            <input type="text" id="author" value="\${escapeHtml(data.author || '')}" required placeholder="例如: bmqy" class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">配置文件URL *</label>
            <input type="url" id="url" value="\${escapeHtml(data.url || '')}" required placeholder="https://example.com/config.conf" class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
        \`;
      }
      
      document.getElementById('modal').classList.remove('hidden');
    }

    // 关闭模态框
    function closeModal() {
      document.getElementById('modal').classList.add('hidden');
    }

    // 提交表单
    async function submitForm(e) {
      e.preventDefault();
      const type = document.getElementById('formType').value;
      const id = document.getElementById('formId').value;
      const endpoint = type === 'platform' ? 'platforms' : 'sources';
      
      let body = {};
      if (type === 'platform') {
        body = {
          platform: document.getElementById('platform').value,
          content: document.getElementById('content').value
        };
      } else {
        body = {
          platform: document.getElementById('platform').value,
          author: document.getElementById('author').value,
          url: document.getElementById('url').value
        };
      }

      const method = id ? 'PUT' : 'POST';
      const url = id ? \`/admin/api/\${endpoint}/\${id}\` : \`/admin/api/\${endpoint}\`;
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        showMessage('保存成功', 'success');
        closeModal();
        loadData();
      } else {
        const error = await res.text();
        showMessage('保存失败: ' + error, 'error');
      }
    }

    // 编辑平台
    function editPlatform(data) {
      openModal('platform', data);
    }

    function editPlatformById(id) {
      const data = platformsData.find(item => item.id === id);
      if (data) editPlatform(data);
    }

    // 删除平台
    async function deletePlatform(id) {
      if (!confirm('确定要删除这个平台吗？')) return;
      const res = await fetch(\`/admin/api/platforms/\${id}\`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        showMessage('删除成功', 'success');
        loadData();
      } else {
        showMessage('删除失败', 'error');
      }
    }

    // 编辑配置源
    function editSource(data) {
      openModal('source', data);
    }

    function editSourceById(id) {
      const data = sourcesData.find(item => item.id === id);
      if (data) editSource(data);
    }

    async function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    async function copySourceAccessLink(id) {
      const res = await fetch(\`/admin/api/sources/\${id}/access-link\`, {
        headers: { 'Authorization': token }
      });

      if (!res.ok) {
        const error = await res.text();
        showMessage(error || '生成访问链接失败', 'error');
        return;
      }

      try {
        const data = await res.json();
        await copyText(data.url);
        showMessage('访问链接已复制', 'success');
      } catch (error) {
        showMessage('复制访问链接失败', 'error');
      }
    }

    // 删除配置源
    async function deleteSource(id) {
      if (!confirm('确定要删除这个配置源吗？')) return;
      const res = await fetch(\`/admin/api/sources/\${id}\`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        showMessage('删除成功', 'success');
        loadData();
      } else {
        showMessage('删除失败', 'error');
      }
    }

    // 显示消息
    function showMessage(msg, type) {
      const div = document.getElementById('message');
      div.classList.remove('hidden');
      
      if (type === 'success') {
        div.className = 'p-4 mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg';
      } else {
        div.className = 'p-4 mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg';
      }
      
      div.textContent = msg;
      setTimeout(() => div.classList.add('hidden'), 3000);
    }
  </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' }
  });
}

/**
 * 处理管理后台API
 */
async function handleAdminApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/admin/api/', '');
  
  // 登录接口不需要验证token
  if (path === 'login' && request.method === 'POST') {
    const body = await request.json();
    if (body.token === env.ADMIN_TOKEN) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('Unauthorized', { status: 401 });
  }

  // 其他接口需要验证token
  const authToken = request.headers.get('Authorization');
  if (!authToken || authToken !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 如果没有KV绑定，返回错误
  if (!getConfigKV(env)) {
    return new Response('KV命名空间未配置', { status: 500 });
  }

  try {
    // 平台管理
    if (path === 'platforms') {
      if (request.method === 'GET') {
        const platforms = await getPlatformList(env);
        return jsonResponse(platforms || []);
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const platform = normalizePlatformStoredValue(body.platform);
        if (!platform) return new Response(`平台名称仅支持 ${getSupportedPlatformText()}`, { status: 400 });
        const platforms = await getPlatformList(env) || [];
        if (platforms.some(item => normalizePlatformStoredValue(item.platform) === platform)) {
          return new Response('平台配置已存在', { status: 409 });
        }
        const now = new Date().toISOString();
        platforms.push({
          id: getNextId(platforms),
          platform,
          content: String(body.content ?? ''),
          created_at: now,
          updated_at: now
        });
        await savePlatformList(env, platforms);
        notifyTelegram(ctx, env, `平台配置已新增: ${formatPlatformName(platform)}`);
        return jsonResponse({ success: true });
      }
    }

    if (path.startsWith('platforms/')) {
      const id = Number(path.split('/')[1]);
      if (request.method === 'PUT') {
        const body = await request.json();
        const platform = normalizePlatformStoredValue(body.platform);
        if (!platform) return new Response(`平台名称仅支持 ${getSupportedPlatformText()}`, { status: 400 });
        const platforms = await getPlatformList(env) || [];
        const existingIndex = platforms.findIndex(item => Number(item.id) === id);
        if (existingIndex === -1) return new Response('Not Found', { status: 404 });
        if (platforms.some(item => Number(item.id) !== id && normalizePlatformStoredValue(item.platform) === platform)) {
          return new Response('平台配置已存在', { status: 409 });
        }
        platforms[existingIndex] = {
          ...platforms[existingIndex],
          platform,
          content: String(body.content ?? ''),
          updated_at: new Date().toISOString()
        };
        await savePlatformList(env, platforms);
        notifyTelegram(ctx, env, `平台配置已更新: ${formatPlatformName(platform)}`);
        return jsonResponse({ success: true });
      }
      if (request.method === 'DELETE') {
        const platforms = await getPlatformList(env) || [];
        const deletedPlatform = platforms.find(item => Number(item.id) === id);
        await savePlatformList(env, platforms.filter(item => Number(item.id) !== id));
        if (deletedPlatform) {
          notifyTelegram(ctx, env, `平台配置已删除: ${formatPlatformName(deletedPlatform.platform)}`);
        }
        return jsonResponse({ success: true });
      }
    }

    // 配置源管理
    if (path === 'sources') {
      if (request.method === 'GET') {
        const sources = await getSourceList(env);
        return jsonResponse(sources || []);
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const platform = normalizePlatformStoredValue(body.platform);
        if (!platform) return new Response(`平台名称仅支持 ${getSupportedPlatformText()}`, { status: 400 });
        const author = String(body.author ?? '').trim();
        const sourceUrl = String(body.url ?? '').trim();
        if (!author || !sourceUrl) return new Response('作者和URL不能为空', { status: 400 });
        const sources = await getSourceList(env) || [];
        if (sources.some(item => String(item.platform).toLowerCase() === platform && String(item.author).toLowerCase() === author)) {
          return new Response('配置源已存在', { status: 409 });
        }
        const now = new Date().toISOString();
        sources.push({
          id: getNextId(sources),
          platform,
          author,
          url: sourceUrl,
          enabled: true,
          created_at: now,
          updated_at: now
        });
        await saveSourceList(env, sources);
        notifyTelegram(ctx, env, `配置源已新增: ${formatPlatformName(platform)} / ${author}`);
        return jsonResponse({ success: true });
      }
    }

    if (path.startsWith('sources/')) {
      const [, idText, action] = path.split('/');
      const id = Number(idText);
      if (request.method === 'GET' && action === 'access-link') {
        if (!env.ACCESS_TOKEN) return new Response('ACCESS_TOKEN未设置', { status: 400 });
        const sources = await getSourceList(env) || [];
        const source = sources.find(item => Number(item.id) === id);
        if (!source) return new Response('Not Found', { status: 404 });

        const platform = normalizePlatformStoredValue(source.platform);
        const author = String(source.author ?? '').trim().toLowerCase();
        if (!platform || !author) return new Response('配置源数据不完整', { status: 400 });

        const accessUrl = new URL(request.url);
        accessUrl.pathname = `/${encodeURIComponent(platform)}/${encodeURIComponent(author)}/${encodeURIComponent(env.ACCESS_TOKEN)}`;
        accessUrl.search = '';
        accessUrl.hash = '';
        return jsonResponse({ url: accessUrl.toString() });
      }
      if (request.method === 'PUT') {
        const body = await request.json();
        const platform = normalizePlatformStoredValue(body.platform);
        if (!platform) return new Response(`平台名称仅支持 ${getSupportedPlatformText()}`, { status: 400 });
        const author = String(body.author ?? '').trim();
        const sourceUrl = String(body.url ?? '').trim();
        if (!author || !sourceUrl) return new Response('作者和URL不能为空', { status: 400 });
        const sources = await getSourceList(env) || [];
        const existingIndex = sources.findIndex(item => Number(item.id) === id);
        if (existingIndex === -1) return new Response('Not Found', { status: 404 });
        if (sources.some(item => Number(item.id) !== id && String(item.platform).toLowerCase() === platform && String(item.author).toLowerCase() === author)) {
          return new Response('配置源已存在', { status: 409 });
        }
        sources[existingIndex] = {
          ...sources[existingIndex],
          platform,
          author,
          url: sourceUrl,
          updated_at: new Date().toISOString()
        };
        await saveSourceList(env, sources);
        notifyTelegram(ctx, env, `配置源已更新: ${formatPlatformName(platform)} / ${author}`);
        return jsonResponse({ success: true });
      }
      if (request.method === 'DELETE') {
        const sources = await getSourceList(env) || [];
        const deletedSource = sources.find(item => Number(item.id) === id);
        await saveSourceList(env, sources.filter(item => Number(item.id) !== id));
        if (deletedSource) {
          notifyTelegram(ctx, env, `配置源已删除: ${formatPlatformName(deletedSource.platform)} / ${deletedSource.author}`);
        }
        return jsonResponse({ success: true });
      }
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('API错误:', error);
    return new Response(error.message, { status: 500 });
  }
}

// 导出默认处理函数
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 路由分发：管理后台路由
    if (pathname === '/admin' || pathname === '/admin/') {
      return handleAdminPage(request, env);
    }
    if (pathname.startsWith('/admin/api/')) {
      return handleAdminApi(request, env, ctx);
    }
    
    // 读取订阅访问令牌
    const ACCESS_TOKEN = env.ACCESS_TOKEN;
    // 解析URL路径，获取平台、作者、token
    const pathParts = pathname.split('/').filter(part => part !== '');
    // 期望格式: /:platform/:author/:token
    if (pathParts.length < 3) {
      return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>地址格式错误</title>
  <style>
    body { background: #f8f9fa; color: #222; font-family: 'Segoe UI',Arial,sans-serif; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 60px auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px #0001; padding: 32px 28px; }
    h1 { color: #e74c3c; font-size: 2em; margin-bottom: 0.5em; }
    code { background: #f3f3f3; color: #c7254e; padding: 2px 6px; border-radius: 4px; }
    .tip { color: #888; font-size: 0.95em; margin-top: 1.5em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>地址格式错误</h1>
    <div>请使用正确的URL格式：<br>
      <code>https://your-worker.workers.dev/:platform/:author/:token</code>
    </div>
    <div style="margin-top:1em;">例如：<br>
      <code>https://your-worker.workers.dev/QuantumultX/bmqy/yourtoken</code>
    </div>
    <div class="tip">token参数必填，且需与环境变量<code>ACCESS_TOKEN</code>一致</div>
  </div>
</body>
</html>`, {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    const platform = normalizePlatformKey(pathParts[0]);
    const author = pathParts[1].toLowerCase();
    const token = pathParts[2];
    // 校验token
    if (!ACCESS_TOKEN || token !== ACCESS_TOKEN) {
      return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>未授权访问</title>
  <style>
    body { background: #f8f9fa; color: #222; font-family: 'Segoe UI',Arial,sans-serif; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 60px auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px #0001; padding: 32px 28px; }
    h1 { color: #e67e22; font-size: 2em; margin-bottom: 0.5em; }
    code { background: #f3f3f3; color: #c7254e; padding: 2px 6px; border-radius: 4px; }
    .tip { color: #888; font-size: 0.95em; margin-top: 1.5em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>未授权访问</h1>
    <div>token无效或未设置。<br>请在URL中携带正确的<code>token</code>参数，且与环境变量<code>ACCESS_TOKEN</code>一致。</div>
    <div class="tip">如有疑问请联系管理员。</div>
  </div>
</body>
</html>`, {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    
    if (!getConfigKV(env)) {
      return new Response('KV命名空间未配置，请先绑定 Cloudflare KV。', { status: 500 });
    }

    if (!platform) {
      return new Response(`平台名称仅支持 ${getSupportedPlatformText()}`, {
        status: 400,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }

    const platformInjection = await getPlatformInjectionFromKV(env, platform);
    if (!platformInjection || !platformInjection.content) {
      return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>平台配置未配置</title>
  <style>
    body { background: #f8f9fa; color: #222; font-family: 'Segoe UI',Arial,sans-serif; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 60px auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px #0001; padding: 32px 28px; }
    h1 { color: #2980b9; font-size: 2em; margin-bottom: 0.5em; }
    code { background: #f3f3f3; color: #c7254e; padding: 2px 6px; border-radius: 4px; }
    .tip { color: #888; font-size: 0.95em; margin-top: 1.5em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>平台配置未配置</h1>
    <div>未找到平台<code>${platform}</code>的注入配置内容。</div>
    <div class="tip">请登录管理后台，在平台配置管理中保存该平台的配置内容。</div>
  </div>
</body>
</html>`, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    let configList = await getSourcesFromKV(env);
    if (!configList) {
      return new Response('读取配置源失败，请检查 Cloudflare KV 绑定和数据。', {
        status: 500,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }
    
    // 解析URL路径，获取平台和作者信息
    // 期望的格式: /:platform/:author
    const matchedConfig = configList.find(
      config => normalizePlatformKey(config.platform) === platform && 
               config.author?.toLowerCase() === author
    );
    if (!matchedConfig || !matchedConfig.url) {
      return new Response(
        `未找到匹配的配置: platform=${platform}, author=${author}\n` +
        "请登录管理后台检查配置源是否存在且已启用", 
        { 
          status: 404,
          headers: { "Content-Type": "text/plain;charset=utf-8" }
        }
      );
    }
    // 获取原始配置文件内容
    const originalConfigUrl = matchedConfig.url;
    notifyTelegram(ctx, env, formatAccessNotification({
      platform,
      sourceUrl: originalConfigUrl,
      token
    }));
    const originalResponse = await fetch(originalConfigUrl);
    if (!originalResponse.ok) {
      return new Response(
        `获取配置文件失败: ${originalResponse.status} ${originalResponse.statusText}\n` +
        `请求的URL: ${originalConfigUrl}`, 
        { 
          status: originalResponse.status,
          headers: { "Content-Type": "text/plain;charset=utf-8" }
        }
      );
    }
    const originalConfig = await originalResponse.text();
    const injectConfigText = platformInjection.content;
    // 使用文本分区合并
    const modifiedConfig = injectConfigToOriginal(originalConfig, injectConfigText, platform);

    return new Response(modifiedConfig, {
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  }
};
