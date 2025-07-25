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
  assets: {
    directory: "./dist"
  },
  triggers: {
    crons: []
  }
};

// 从环境变量获取配置
function getConfigFromEnv() {
  const config = JSON.parse(JSON.stringify(defaultConfig)); // 深拷贝默认配置
  return config;
}

// 生成TOML格式的配置
function generateToml(config) {
  let toml = `name = "${config.name}"\n`;
  toml += `main = "${config.main}"\n`;
  toml += `compatibility_date = "${config.compatibility_date}"\n\n`;
  toml += `keep_vars = ${config.keep_vars}\n`;
  toml += `[assets]\n`;
  toml += `directory = "${config.assets.directory}"\n`;

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
