/**
 * Cloudflare Worker脚本 - QuantumultX配置注入
 * 用于在QuantumultX的conf配置文件中注入自定义内容
 */

/**
 * 在原始配置文件中注入自定义内容
 * @param {string} originalConfig 原始配置文件内容
 * @param {string} injectConfigText 注入配置内容
 * @param {string} platform 平台名称
 * @returns {string} 注入后的配置文件内容
 */
function injectConfigToOriginal(originalConfig, injectConfigText, platform) {
  // 这里实现配置合并逻辑
  // 简单示例：直接将注入内容附加到原始配置后
  return originalConfig + '\n' + injectConfigText;
}

// 导出默认处理函数
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 处理API请求
    if (pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env, ctx);
    }
    
    // 处理带token的配置请求 /:platform/:author/:token
    if (pathname.split('/').filter(part => part !== '').length === 3) {
      return handleTokenConfigRequest(request, env, ctx);
    }
    
    // 处理静态文件
    return handleStaticFiles(request, env, ctx);
  }
};

/**
 * 处理带token的配置请求
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleTokenConfigRequest(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 解析路径 /:platform/:author/:token
    const pathParts = pathname.split('/').filter(part => part !== '');
    if (pathParts.length !== 3) {
      return new Response('路径格式错误', { status: 400 });
    }
    
    const platform = pathParts[0];
    const author = pathParts[1];
    const token = pathParts[2];
    
    // 验证token
    const storedToken = await env["CONF-INJECT-SCRIPT"].get('api-token');
    if (!storedToken || storedToken !== token) {
      return new Response('无效的访问令牌', { status: 401 });
    }
    
    // 获取作者配置
    const configId = `${platform}-${author}`;
    const configStr = await env["CONF-INJECT-SCRIPT"].get(`config-${configId}`);
    
    if (configStr === null) {
      return new Response('配置未找到', { status: 404 });
    }
    
    const config = JSON.parse(configStr);
    
    // 获取原始配置文件
    const originalResponse = await fetch(config.url);
    if (!originalResponse.ok) {
      return new Response('获取原始配置文件失败', { status: 500 });
    }
    
    const originalConfig = await originalResponse.text();
    
    // 获取平台注入内容
    const injectConfigText = await env["CONF-INJECT-SCRIPT"].get(`platform-${platform}`);
    if (injectConfigText === null) {
      return new Response('平台注入内容未找到', { status: 404 });
    }
    
    // 合并配置
    const mergedConfig = injectConfigToOriginal(originalConfig, injectConfigText, platform);
    
    return new Response(mergedConfig, {
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('处理配置合并时出错:', error);
    return new Response('处理配置合并时出错: ' + error.message, { status: 500 });
  }
}

/**
 * 处理API请求
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleAPIRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // 登录接口
  if (pathname === '/api/login') {
    return handleLogin(request, env, ctx);
  }
  
  // 管理接口需要身份验证
  const isAuthenticated = await checkAuth(request, env);
  if (!isAuthenticated) {
    return new Response(JSON.stringify({ error: '未授权访问' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // API Token管理接口
  if (pathname === '/api/token') {
    if (request.method === 'GET') {
      return handleGetToken(request, env, ctx);
    } else if (request.method === 'POST') {
      return handleSaveToken(request, env, ctx);
    }
  }
  
  // 管理平台注入内容
  if (pathname === '/api/platforms') {
    if (request.method === 'GET') {
      return handleGetPlatforms(request, env, ctx);
    } else if (request.method === 'POST') {
      return handleCreatePlatform(request, env, ctx);
    }
  }
  
  // 管理特定平台注入内容
  if (pathname.startsWith('/api/platforms/')) {
    const platformName = pathname.split('/')[3];
    if (request.method === 'GET') {
      return handleGetPlatform(request, env, ctx, platformName);
    } else if (request.method === 'PUT') {
      return handleUpdatePlatform(request, env, ctx, platformName);
    } else if (request.method === 'DELETE') {
      return handleDeletePlatform(request, env, ctx, platformName);
    }
  }
  
  // 管理平台作者配置
  if (pathname === '/api/configs') {
    if (request.method === 'GET') {
      return handleGetConfigs(request, env, ctx);
    } else if (request.method === 'POST') {
      return handleCreateConfig(request, env, ctx);
    }
  }
  
  // 管理特定配置
  if (pathname.startsWith('/api/configs/')) {
    const configId = pathname.split('/')[3];
    if (request.method === 'GET') {
      return handleGetConfig(request, env, ctx, configId);
    } else if (request.method === 'PUT') {
      return handleUpdateConfig(request, env, ctx, configId);
    } else if (request.method === 'DELETE') {
      return handleDeleteConfig(request, env, ctx, configId);
    }
  }
  
  // 获取合并后的配置
  if (pathname.startsWith('/config/')) {
    return handleGetMergedConfig(request, env, ctx);
  }
  
  return new Response(JSON.stringify({ error: '接口不存在' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * 处理静态文件
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleStaticFiles(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // 提供Vue构建的静态文件
  const filePath = pathname === '/' ? '/index.html' : pathname;
  
  try {
    // 从KV中获取静态文件内容
    const fileContent = await env["CONF-INJECT-SCRIPT"].get(`static${filePath}`);
    
    if (fileContent) {
      const contentType = getContentType(filePath);
      return new Response(fileContent, {
        headers: { 'Content-Type': contentType }
      });
    }
  } catch (error) {
    console.error('获取静态文件出错:', error);
  }
  
  return new Response('文件未找到', { status: 404 });
}

/**
 * 获取内容类型
 * @param {string} filePath 文件路径
 * @returns {string} 内容类型
 */
function getContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html;charset=UTF-8';
  if (filePath.endsWith('.css')) return 'text/css;charset=UTF-8';
  if (filePath.endsWith('.js')) return 'application/javascript;charset=UTF-8';
  if (filePath.endsWith('.json')) return 'application/json;charset=UTF-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.gif')) return 'image/gif';
  return 'text/plain;charset=UTF-8';
}

/**
 * 处理登录
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleLogin(request, env, ctx) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '方法不允许' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { username, password } = await request.json();
    
    // 验证用户名和密码
    if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
      // 在实际应用中，应该生成和验证JWT令牌或使用其他身份验证机制
      return new Response(JSON.stringify({ 
        success: true, 
        message: '登录成功',
        token: 'fake-jwt-token'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '用户名或密码错误'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: '请求参数错误'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 检查身份验证
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @returns {boolean} 是否通过身份验证
 */
async function checkAuth(request, env) {
  // 在实际应用中，应该验证JWT令牌或其他身份验证机制
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  
  // 简单示例：检查Bearer令牌
  const token = authHeader.replace('Bearer ', '');
  return token === 'fake-jwt-token';
}

/**
 * 处理获取API Token
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleGetToken(request, env, ctx) {
  try {
    const token = await env["CONF-INJECT-SCRIPT"].get('api-token') || '';
    
    return new Response(JSON.stringify({ token }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取API Token出错:', error);
    return new Response(JSON.stringify({ error: '获取API Token失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理保存API Token
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleSaveToken(request, env, ctx) {
  try {
    const { token } = await request.json();
    
    if (typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Token必须是字符串' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env["CONF-INJECT-SCRIPT"].put('api-token', token);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Token保存成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('保存API Token出错:', error);
    return new Response(JSON.stringify({ error: '保存API Token失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理获取所有平台
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleGetPlatforms(request, env, ctx) {
  try {
    // 检查KV命名空间是否存在
    if (!env["CONF-INJECT-SCRIPT"]) {
      return new Response(JSON.stringify({ error: 'KV命名空间未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const list = await env["CONF-INJECT-SCRIPT"].list({ prefix: 'platform-' });
    const platforms = [];
    
    for (const key of list.keys) {
      try {
        const content = await env["CONF-INJECT-SCRIPT"].get(key.name);
        const platformName = key.name.replace('platform-', '');
        platforms.push({
          name: platformName,
          content: content || ''
        });
      } catch (error) {
        console.error(`获取平台 ${key.name} 数据出错:`, error);
      }
    }
    
    return new Response(JSON.stringify(platforms), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取平台列表出错:', error);
    return new Response(JSON.stringify({ error: '获取平台列表失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理创建平台
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleCreatePlatform(request, env, ctx) {
  try {
    const { name, content } = await request.json();
    
    if (!name || !content) {
      return new Response(JSON.stringify({ error: '平台名称和内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env["CONF-INJECT-SCRIPT"].put(`platform-${name}`, content);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '平台创建成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('创建平台出错:', error);
    return new Response(JSON.stringify({ error: '创建平台失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理获取特定平台
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @param {string} platformName 平台名称
 * @returns {Response} 响应对象
 */
async function handleGetPlatform(request, env, ctx, platformName) {
  try {
    const content = await env["CONF-INJECT-SCRIPT"].get(`platform-${platformName}`);
    
    if (content === null) {
      return new Response(JSON.stringify({ error: '平台未找到' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      name: platformName,
      content: content
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取平台出错:', error);
    return new Response(JSON.stringify({ error: '获取平台失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理更新特定平台
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @param {string} platformName 平台名称
 * @returns {Response} 响应对象
 */
async function handleUpdatePlatform(request, env, ctx, platformName) {
  try {
    const { content } = await request.json();
    
    if (!content) {
      return new Response(JSON.stringify({ error: '内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env["CONF-INJECT-SCRIPT"].put(`platform-${platformName}`, content);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '平台更新成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('更新平台出错:', error);
    return new Response(JSON.stringify({ error: '更新平台失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理删除特定平台
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @param {string} platformName 平台名称
 * @returns {Response} 响应对象
 */
async function handleDeletePlatform(request, env, ctx, platformName) {
  try {
    await env["CONF-INJECT-SCRIPT"].delete(`platform-${platformName}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '平台删除成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('删除平台出错:', error);
    return new Response(JSON.stringify({ error: '删除平台失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理获取所有配置
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleGetConfigs(request, env, ctx) {
  try {
    // 检查KV命名空间是否存在
    if (!env["CONF-INJECT-SCRIPT"]) {
      return new Response(JSON.stringify({ error: 'KV命名空间未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const list = await env["CONF-INJECT-SCRIPT"].list({ prefix: 'config-' });
    const configs = [];
    
    for (const key of list.keys) {
      try {
        const configStr = await env["CONF-INJECT-SCRIPT"].get(key.name);
        const config = JSON.parse(configStr);
        config.id = key.name.replace('config-', '');
        configs.push(config);
      } catch (error) {
        console.error(`获取配置 ${key.name} 数据出错:`, error);
      }
    }
    
    return new Response(JSON.stringify(configs), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取配置列表出错:', error);
    return new Response(JSON.stringify({ error: '获取配置列表失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理创建配置
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleCreateConfig(request, env, ctx) {
  try {
    const config = await request.json();
    
    if (!config.platform || !config.author || !config.url) {
      return new Response(JSON.stringify({ error: '平台、作者和链接不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const configId = `${config.platform}-${config.author}`;
    await env["CONF-INJECT-SCRIPT"].put(`config-${configId}`, JSON.stringify(config));
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '配置创建成功',
      id: configId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('创建配置出错:', error);
    return new Response(JSON.stringify({ error: '创建配置失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理获取特定配置
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @param {string} configId 配置ID
 * @returns {Response} 响应对象
 */
async function handleGetConfig(request, env, ctx, configId) {
  try {
    const configStr = await env["CONF-INJECT-SCRIPT"].get(`config-${configId}`);
    
    if (configStr === null) {
      return new Response(JSON.stringify({ error: '配置未找到' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const config = JSON.parse(configStr);
    config.id = configId;
    
    return new Response(JSON.stringify(config), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取配置出错:', error);
    return new Response(JSON.stringify({ error: '获取配置失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理更新特定配置
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @param {string} configId 配置ID
 * @returns {Response} 响应对象
 */
async function handleUpdateConfig(request, env, ctx, configId) {
  try {
    const config = await request.json();
    
    if (!config.platform || !config.author || !config.url) {
      return new Response(JSON.stringify({ error: '平台、作者和链接不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env["CONF-INJECT-SCRIPT"].put(`config-${configId}`, JSON.stringify(config));
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '配置更新成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('更新配置出错:', error);
    return new Response(JSON.stringify({ error: '更新配置失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理删除特定配置
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @param {string} configId 配置ID
 * @returns {Response} 响应对象
 */
async function handleDeleteConfig(request, env, ctx, configId) {
  try {
    await env["CONF-INJECT-SCRIPT"].delete(`config-${configId}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '配置删除成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('删除配置出错:', error);
    return new Response(JSON.stringify({ error: '删除配置失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理获取合并后的配置（旧接口，保留兼容性）
 * @param {Request} request 请求对象
 * @param {object} env 环境变量
 * @param {object} ctx 上下文
 * @returns {Response} 响应对象
 */
async function handleGetMergedConfig(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 解析路径 /config/:platform/:author
    const pathParts = pathname.split('/').filter(part => part !== '');
    if (pathParts.length < 3) {
      return new Response('路径格式错误', { status: 400 });
    }
    
    const platform = pathParts[1];
    const author = pathParts[2];
    
    // 获取作者配置
    const configId = `${platform}-${author}`;
    const configStr = await env["CONF-INJECT-SCRIPT"].get(`config-${configId}`);
    
    if (configStr === null) {
      return new Response('配置未找到', { status: 404 });
    }
    
    const config = JSON.parse(configStr);
    
    // 获取原始配置文件
    const originalResponse = await fetch(config.url);
    if (!originalResponse.ok) {
      return new Response('获取原始配置文件失败', { status: 500 });
    }
    
    const originalConfig = await originalResponse.text();
    
    // 获取平台注入内容
    const injectConfigText = await env["CONF-INJECT-SCRIPT"].get(`platform-${platform}`);
    if (injectConfigText === null) {
      return new Response('平台注入内容未找到', { status: 404 });
    }
    
    // 合并配置
    const mergedConfig = injectConfigToOriginal(originalConfig, injectConfigText, platform);
    
    return new Response(mergedConfig, {
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('处理配置合并时出错:', error);
    return new Response('处理配置合并时出错: ' + error.message, { status: 500 });
  }
}