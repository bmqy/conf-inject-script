#!/usr/bin/env node

/**
 * 构建脚本 - 生成wrangler.toml配置文件
 * 
 * 此脚本会根据环境变量生成Cloudflare Workers所需的wrangler.toml配置文件
 * 使用方法: node build.js
 */

const fs = require('fs');
const path = require('path');

// 加载.env文件
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath)) {
    console.log('发现.env文件，正在加载环境变量...');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    let currentKey = null;
    let multilineValue = '';
    let isMultiline = false;
    
    envLines.forEach(line => {
      // 忽略注释和空行
      if (!line || line.startsWith('#')) return;
      
      if (isMultiline) {
        // 处理多行值
        multilineValue += line;
        
        // 检查是否是多行值的结束
        if (line.trim().endsWith(']')) {
          process.env[currentKey] = multilineValue.trim();
          isMultiline = false;
          multilineValue = '';
          currentKey = null;
        }
        return;
      }
      
      // 检查是否是多行值的开始
      if (line.includes('=[') && !line.trim().endsWith(']')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          currentKey = match[1];
          multilineValue = match[2] || '';
          isMultiline = true;
        }
        return;
      }
      
      // 解析 KEY=VALUE 格式
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        
        // 去除引号
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        // 设置环境变量
        process.env[key] = value;
      }
    });
    
    console.log('环境变量加载完成');
  }
}

// 默认配置
const defaultConfig = {
  name: "conf-inject-script",
  main: "src/worker.js",
  compatibility_date: "2023-09-04",
  keep_vars: true,
  triggers: {
    crons: []
  }
};

// 从环境变量获取配置
function getConfigFromEnv() {
  const config = JSON.parse(JSON.stringify(defaultConfig)); // 深拷贝默认配置
  
  // INJECT_SOURCE_CONFIG_LIST
  if (process.env.INJECT_SOURCE_CONFIG_LIST) {
    try {
      if (typeof process.env.INJECT_SOURCE_CONFIG_LIST === 'string') {
        config.vars.INJECT_SOURCE_CONFIG_LIST = process.env.INJECT_SOURCE_CONFIG_LIST;
      } else if (Array.isArray(process.env.INJECT_SOURCE_CONFIG_LIST)) {
        config.vars.INJECT_SOURCE_CONFIG_LIST = process.env.INJECT_SOURCE_CONFIG_LIST;
      }
    } catch (error) {
      console.warn('警告: 解析INJECT_SOURCE_CONFIG_LIST环境变量失败，使用原始字符串');
      config.vars.INJECT_SOURCE_CONFIG_LIST = process.env.INJECT_SOURCE_CONFIG_LIST;
    }
  }
  // INJECT_PLATFORM_LIST
  if (process.env.INJECT_PLATFORM_LIST) {
    try {
      if (typeof process.env.INJECT_PLATFORM_LIST === 'string') {
        config.vars.INJECT_PLATFORM_LIST = process.env.INJECT_PLATFORM_LIST;
      } else if (typeof process.env.INJECT_PLATFORM_LIST === 'object') {
        config.vars.INJECT_PLATFORM_LIST = process.env.INJECT_PLATFORM_LIST;
      }
    } catch (error) {
      console.warn('警告: 解析INJECT_PLATFORM_LIST环境变量失败，使用原始字符串');
      config.vars.INJECT_PLATFORM_LIST = process.env.INJECT_PLATFORM_LIST;
    }
  }
  // 新增：ACCESS_TOKEN
  if (process.env.ACCESS_TOKEN) {
    config.vars.ACCESS_TOKEN = process.env.ACCESS_TOKEN;
  }
  // TELEGRAM_BOT_TOKEN
  if (process.env.TELEGRAM_BOT_TOKEN) {
    config.vars.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  }
  // TELEGRAM_CHAT_ID
  if (process.env.TELEGRAM_CHAT_ID) {
    config.vars.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  }
  
  // 如果环境变量中有WORKER_NAME，则使用环境变量中的值
  if (process.env.WORKER_NAME) {
    config.name = process.env.WORKER_NAME;
  }

  return config;
}

// 生成TOML格式的配置
function generateToml(config) {
  let toml = `name = "${config.name}"\n`;
  toml += `main = "${config.main}"\n`;
  toml += `compatibility_date = "${config.compatibility_date}"\n\n`;
  toml += `keep_vars = true\n`;
  
  // 添加触发器配置
  toml += `[triggers]\n`;
  toml += `crons = []\n\n`;
  
  return toml;
}

// 主函数
function main() {
  try {
    // 加载.env文件
    loadEnvFile();
    
    // 获取配置
    const config = getConfigFromEnv();
    
    // 生成TOML
    const toml = generateToml(config);
    
    // 写入文件
    fs.writeFileSync(path.join(__dirname, '../wrangler.toml'), toml);
    
    console.log('成功生成 wrangler.toml 文件');
    console.log(`Worker名称: ${config.name}`);

  } catch (error) {
    console.error('生成 wrangler.toml 文件时出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main();
