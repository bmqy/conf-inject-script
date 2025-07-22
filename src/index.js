/**
 * Cloudflare Worker脚本 - QuantumultX配置注入
 * 用于在QuantumultX的conf配置文件中注入自定义内容
 */

import { mergeConfBySectionRegex } from '../platform-conf-parser.js';

/**
 * 在原始配置文件中注入自定义内容
 * @param {string} originalConfig 原始配置文件内容
 * @param {Object} injectConfigs 注入配置对象
 * @returns {string} 注入后的配置文件内容
 */
function injectConfigToOriginal(originalConfig, injectConfigText, platform) {
  return mergeConfBySectionRegex(originalConfig, injectConfigText, platform);
}

// 导出默认处理函数
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
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
    const gistResponse = await fetch(gistUrl);
    if (!gistResponse.ok) {
      return new Response(
        `获取gist注入内容失败: ${gistResponse.status} ${gistResponse.statusText}\n` +
        `请求的URL: ${gistUrl}`,
        {
          status: gistResponse.status,
          headers: { "Content-Type": "text/plain;charset=utf-8" }
        }
      );
    }
    const injectConfigText = await gistResponse.text();
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
