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
  const envPath = path.join(__dirname, '../', '.env');
  
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
  main: "src/index.js",
  compatibility_date: "2023-09-04",
  vars: {
    INJECT_SOURCE_CONFIG_LIST: "[]",
    INJECT_PLATFORM_LIST: "{}",
    ACCESS_TOKEN: ""
  },
  triggers: {
    crons: []
  }
};

// 从环境变量获取配置
function getConfigFromEnv() {
  const config = { ...defaultConfig };
  
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
  
  // 如果环境变量中有WORKER_NAME，则使用环境变量中的值
  if (process.env.WORKER_NAME) {
    config.name = process.env.WORKER_NAME;
  }
  
  return config;
}

// 生成TOML格式的配置
function generateToml(config) {
  let toml = `name = "${config.name.trim()}"\n`;
  toml += `main = "${config.main}"\n`;
  toml += `compatibility_date = "${config.compatibility_date}"\n\n`;
  
  // 添加keep_vars以保留现有的环境变量
  toml += `keep_vars = true\n\n`;
  
  // 添加触发器配置
  toml += `[triggers]\n`;
  toml += `crons = []\n\n`;
  
  // 添加环境变量配置
  toml += `[vars]\n`;
  
  // INJECT_SOURCE_CONFIG_LIST
  let configList = config.vars.INJECT_SOURCE_CONFIG_LIST;
  try {
    if (typeof configList === 'string') {
      const parsedList = JSON.parse(configList);
      configList = `'''${JSON.stringify(parsedList)}'''`;
    } else if (Array.isArray(configList)) {
      configList = `'''${JSON.stringify(configList)}'''`;
    } else {
      configList = `'''[]'''`;
    }
  } catch (error) {
    configList = `'''[]'''`;
  }
  toml += `INJECT_SOURCE_CONFIG_LIST = ${configList}\n`;
  
  // INJECT_PLATFORM_LIST
  let platformList = config.vars.INJECT_PLATFORM_LIST;
  try {
    if (typeof platformList === 'string') {
      const parsedList = JSON.parse(platformList);
      platformList = `'''${JSON.stringify(parsedList)}'''`;
    } else if (typeof platformList === 'object') {
      platformList = `'''${JSON.stringify(platformList)}'''`;
    } else {
      platformList = `'''{}'''`;
    }
  } catch (error) {
    platformList = `'''{}'''`;
  }
  toml += `INJECT_PLATFORM_LIST = ${platformList}\n`;
  
  // ACCESS_TOKEN
  let accessToken = config.vars.ACCESS_TOKEN;
  if (typeof accessToken !== 'string') accessToken = String(accessToken || '');
  toml += `ACCESS_TOKEN = '''${accessToken}'''\n`;
  
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
    
    // INJECT_SOURCE_CONFIG_LIST摘要
    try {
      const configList = JSON.parse(config.vars.INJECT_SOURCE_CONFIG_LIST);
      console.log(`配置列表: 包含 ${configList.length} 个配置项`);
      configList.forEach((item, index) => {
        console.log(`  [${index + 1}] ${item.platform || '未知平台'} / ${item.author || '未知作者'}`);
      });
    } catch (error) {
      console.log('配置列表: 无法解析');
    }
    // INJECT_PLATFORM_LIST摘要
    try {
      const platformList = JSON.parse(config.vars.INJECT_PLATFORM_LIST);
      const keys = Object.keys(platformList);
      console.log(`平台Gist映射: 包含 ${keys.length} 个平台`);
      keys.forEach((key, idx) => {
        console.log(`  [${idx + 1}] ${key}: ${platformList[key]}`);
      });
    } catch (error) {
      console.log('平台Gist映射: 无法解析');
    }
    // ACCESS_TOKEN摘要
    if (config.vars.ACCESS_TOKEN) {
      console.log(`访问Token: ${config.vars.ACCESS_TOKEN.length > 0 ? '[已设置]' : '[未设置]'}`);
    }
  } catch (error) {
    console.error('生成 wrangler.toml 文件时出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main();