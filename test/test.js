// ... existing code ...
const fs = require('fs');
const path = require('path');
const { mergeConfBySectionRegex } = require('../platform-conf-parser');

function injectConfigToOriginal(originalConfig, injectConfigText, platform) {
  return mergeConfBySectionRegex(originalConfig, injectConfigText, platform);
}

async function main() {
  try {
    const configPath = path.join(__dirname, '..', 'example-config.conf');
    const originalConfig = fs.readFileSync(configPath, 'utf8');
    const injectConfigPath = path.join(__dirname, '..', 'inject-config.conf');
    const injectConfigText = fs.readFileSync(injectConfigPath, 'utf8');
    console.log('原始配置文件内容:');
    console.log('-'.repeat(50));
    console.log(originalConfig);
    console.log('-'.repeat(50));
    console.log('\n注入配置文件内容:');
    console.log('-'.repeat(50));
    console.log(injectConfigText);
    console.log('-'.repeat(50));
    // 文本分区合并
    const modifiedConfig = injectConfigToOriginal(originalConfig, injectConfigText, 'quanx');
    console.log('\n注入后的配置文件内容:');
    console.log('-'.repeat(50));
    console.log(modifiedConfig);
    console.log('-'.repeat(50));
    const outputPath = path.join(__dirname, '..', 'modified-config.conf');
    fs.writeFileSync(outputPath, modifiedConfig, 'utf8');
    console.log(`\n修改后的配置已保存到: ${outputPath}`);
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}




main();



