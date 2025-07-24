/**
 * Cloudflare Worker脚本 - QuantumultX配置注入
 * 用于在QuantumultX的conf配置文件中注入自定义内容
 */

import { mergeConfBySectionRegex } from '../utils/platform-conf-parser.js';
import fs from 'fs';

// 如果需要使用路径拼接，使用 utils/build.js 中定义的 joinPaths 函数
import { joinPaths } from '../utils/build.js';

/**
 * 在原始配置文件中注入自定义内容
 * @param {string} originalConfig 原始配置文件内容
 * @param {Object} injectConfigs 注入配置对象
 * @returns {string} 注入后的配置文件内容
 */
function injectConfigToOriginal(originalConfig, injectConfigText, platform) {
  return mergeConfBySectionRegex(originalConfig, injectConfigText, platform);
}

// 提供静态HTML文件
async function serveHTML(request, filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
    },
  });
}

// 检查是否为管理员
function isAdmin(request) {
  // 临时绕过身份验证以测试 API
  return true; // 可以考虑添加IP白名单或其他安全措施
}

// 处理登录请求
async function handleLogin(request, env) {
  if (request.method === 'POST') {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');
    
    // 从环境变量中获取管理员凭据
    const adminUser = env.ADMIN_USER || 'admin';
    const adminPass = env.ADMIN_PASSWORD || 'password';
    
    if (username === adminUser && password === adminPass) {
      // 登录成功，设置会话或返回成功响应
      const response = new Response('登录成功', { status: 302 });
      response.headers.set('Location', '/admin');
      return response;
    } else {
      return new Response('登录失败：用户名或密码错误', { status: 401 });
    }
  } else {
    return new Response(generateLoginPage(), { headers: { 'Content-Type': 'text/html' } });
  }
}

// 处理管理页面请求
async function handleAdmin(request, env) {
  // 检查是否为管理员
  if (!isAdmin(request, env)) {
    return new Response('未授权访问', { status: 401, headers: { 'Content-Type': 'text/html' } });
  }
  
  // 获取KV中的数据
  const kvNamespace = env.CONF_INJECT_SCRIPT;
  if (!kvNamespace) {
    return new Response('KV命名空间未找到', { status: 500 });
  }
  
  // 列出所有键值对
  const list = await kvNamespace.list();
  const kvData = {};
  
  // 获取所有键的值
  const keys = list.keys || [];
  for (const key of keys) {
    const value = await kvNamespace.get(key.name);
    if (value !== null) {
      kvData[key.name] = value;
    }
  }
  
  return new Response(generateAdminPage(kvData), { headers: { 'Content-Type': 'text/html' } });
}

// 处理管理页面数据请求
async function handleAdminData(request, env) {
  try {
    const kvNamespace = env.CONF_INJECT_SCRIPT;
    if (!kvNamespace) {
      return new Response(JSON.stringify({ error: 'KV命名空间未找到' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const kvData = await kvNamespace.list();
    return new Response(JSON.stringify(kvData), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // 添加CORS支持
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: '获取数据失败', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 处理添加数据请求
async function handleAdd(request, env) {
  // 绕过身份验证
  // if (!isAdmin(request, env)) {
  //   return new Response(JSON.stringify({ error: '未授权访问' }), { status: 401 });
  // }
  
  try {
    const { key, value } = await request.json();
    if (!key || !value) {
      return new Response(JSON.stringify({ error: '键和值不能为空' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const kvNamespace = env.CONF_INJECT_SCRIPT;
    if (!kvNamespace) {
      return new Response(JSON.stringify({ error: 'KV命名空间未找到' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await kvNamespace.put(key, value);
    return new Response(JSON.stringify({ success: true, message: '添加成功' }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // 添加CORS支持
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: '添加失败', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 处理更新数据请求
async function handleUpdate(request, env) {
  // 绕过身份验证
  // if (!isAdmin(request, env)) {
  //   return new Response(JSON.stringify({ error: '未授权访问' }), { status: 401 });
  // }
  
  try {
    const { key, value } = await request.json();
    if (!key || !value) {
      return new Response(JSON.stringify({ error: '键和值不能为空' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const kvNamespace = env.CONF_INJECT_SCRIPT;
    if (!kvNamespace) {
      return new Response(JSON.stringify({ error: 'KV命名空间未找到' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await kvNamespace.put(key, value);
    return new Response(JSON.stringify({ success: true, message: '更新成功' }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // 添加CORS支持
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: '更新失败', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 处理删除数据请求
async function handleDelete(request, env) {
  // 绕过身份验证
  // if (!isAdmin(request, env)) {
  //   return new Response(JSON.stringify({ error: '未授权访问' }), { status: 401 });
  // }
  
  try {
    const { key } = await request.json();
    if (!key) {
      return new Response(JSON.stringify({ error: '键不能为空' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const kvNamespace = env.CONF_INJECT_SCRIPT;
    if (!kvNamespace) {
      return new Response(JSON.stringify({ error: 'KV命名空间未找到' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await kvNamespace.delete(key);
    return new Response(JSON.stringify({ success: true, message: '删除成功' }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // 添加CORS支持
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: '删除失败', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 导出默认处理函数
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // API优先匹配
    const apiRoutes = {
      '/admin/data': handleAdminData,
      '/admin/add': handleAdd,
      '/admin/update': handleUpdate,
      '/admin/delete': handleDelete
    };
    
    if (pathname in apiRoutes) {
      return apiRoutes[pathname](request, env);
    }
    
    // 管理界面路由
    if (url.pathname === '/login' || url.pathname === '/admin') {
      return serveHTML(request, joinPaths(__dirname, url.pathname === '/admin' ? 'admin.html' : 'login.html'));
    }
    
    // 新增：读取ACCESS_TOKEN
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
      <code>https://your-worker.workers.dev/quanx/bmqy/yourtoken</code>
    </div>
    <div class="tip">token参数必填，且需与环境变量<code>ACCESS_TOKEN</code>一致</div>
  </div>
</body>
</html>`, {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    const platform = pathParts[0].toLowerCase();
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
    // 解析平台-gist映射
    let platformGistMap;
    try {
      platformGistMap = JSON.parse(env.INJECT_PLATFORM_LIST || '{}');
    } catch (e) {
      return new Response('解析INJECT_PLATFORM_LIST环境变量失败: ' + e.message, { status: 500 });
    }
    const gistUrl = platformGistMap[platform];
    if (!gistUrl) {
      return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>平台未配置</title>
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
    <h1>平台未配置</h1>
    <div>未找到平台<code>${platform}</code>的gist配置地址。</div>
    <div class="tip">请检查环境变量<code>INJECT_PLATFORM_LIST</code>是否正确配置。</div>
  </div>
</body>
</html>`, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    
    // 从环境变量获取配置列表
    let configList;
    try {
      configList = JSON.parse(env.INJECT_SOURCE_CONFIG_LIST || '[]');
      console.log(`成功解析INJECT_SOURCE_CONFIG_LIST，包含${configList.length}个配置项`);
    } catch (error) {
      console.log(`解析INJECT_SOURCE_CONFIG_LIST环境变量失败: ${error.message}`);
      return new Response(
        `解析INJECT_SOURCE_CONFIG_LIST环境变量失败: ${error.message}\n` +
        "请确保环境变量是有效的JSON数组格式", 
        { 
          status: 500,
          headers: { "Content-Type": "text/plain;charset=utf-8" }
        }
      );
    }
    
    // 解析URL路径，获取平台和作者信息
    // 期望的格式: /:platform/:author
    const matchedConfig = configList.find(
      config => config.platform?.toLowerCase() === platform && 
               config.author?.toLowerCase() === author
    );
    if (!matchedConfig || !matchedConfig.url) {
      return new Response(
        `未找到匹配的配置: platform=${platform}, author=${author}\n` +
        "请检查INJECT_SOURCE_CONFIG_LIST环境变量中是否包含此配置", 
        { 
          status: 404,
          headers: { "Content-Type": "text/plain;charset=utf-8" }
        }
      );
    }
    // 获取原始配置文件内容
    const originalConfigUrl = matchedConfig.url;
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
    // 从Cloudflare KV获取注入内容
    const injectConfigText = await env.CONF_INJECT_SCRIPT.get(`platform-${platform}`);
    if (!injectConfigText) {
      return new Response(`未找到平台<code>${platform}</code>的注入内容。`, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    // 使用文本分区合并
    const modifiedConfig = injectConfigToOriginal(originalConfig, injectConfigText, platform);

    // 新增：发送Telegram通知
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const tgToken = env.TELEGRAM_BOT_TOKEN;
      const tgChatId = env.TELEGRAM_CHAT_ID;
      // MarkdownV2严格转义函数
      function escapeMarkdownV2(text) {
        return String(text).replace(/([_\*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
      }
      // 构造消息内容，所有内容都转义
      const msg = `${escapeMarkdownV2('#通知服务 #配置注入脚本')}\n\n${escapeMarkdownV2('有新的请求')}\n\n平台: ${escapeMarkdownV2(platform)}\n源文件: ${escapeMarkdownV2(matchedConfig.url || '')}\nToken: ||${escapeMarkdownV2(token)}||`;
      const tgApi = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      try {
        await fetch(tgApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: msg,
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true
          })
        });
      } catch (e) {
        // 可选：console.log('Telegram通知失败', e);
      }
    }

    return new Response(modifiedConfig, {
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  }
}; 
