// QuantumultX/Loon conf结构化解析器
// 支持分区唯一、[general]/[mitm] key唯一、注释保留

const SECTION_RE = /^\s*\[([^\]]+)\]\s*$/;
const KV_RE = /^\s*([^=\s#][^=]*)=(.*)$/;

// 平台支持的分区定义
const PLATFORM_SECTIONS = {
  quanx: [
    'general', 'dns', 'policy', 'filter_local', 'filter_remote', 'server_local', 'server_remote', 'rewrite_local', 'rewrite_remote', 'task_local', 'http_backend', 'mitm'
  ],
  loon: [
    'general', 'proxy', 'remote proxy', 'remote filter', 'proxy group', 'rule', 'remote rule', 'host',
    'rewrite', 'script', 'plugin', 'mitm'
  ]
};

// 各分区条目去重策略（同一条目以注入内容为准）：
// key         - 取首个 = 前的键名，适用于 `Name = value` 形式（[host]/[proxy]/[proxy group]）
// afterFirstEq- 取首个逗号字段中首个 = 之后的部分，适用于 `type=Name` 形式（[policy]）
// tag         - 取 tag= 的值，找不到时退化为 first，适用于带 tag 的节点条目（[server_local]）
// first       - 取首个逗号字段，含 = 时取 = 之前的部分，否则取首个空白分隔字段，
//               适用于 URL、脚本规则等以首个字段唯一标识的条目
// script      - 取行内的脚本 URL/路径，找不到时退化为整行（[task_local]/[script]）
// line        - 整行作为条目标识，只去重完全相同的条目（规则列表等）
// 未列出的分区默认使用 line
const SECTION_IDENTITY_STRATEGIES = {
  quanx: {
    policy: 'afterFirstEq',
    server_local: 'tag',
    filter_remote: 'first',
    server_remote: 'first',
    rewrite_local: 'first',
    rewrite_remote: 'first',
    task_local: 'script'
  },
  loon: {
    proxy: 'key',
    'proxy group': 'key',
    host: 'key',
    'remote proxy': 'first',
    'remote filter': 'first',
    'remote rule': 'first',
    rewrite: 'first',
    plugin: 'first',
    script: 'script'
  }
};

function normalizePlatformKey(platform) {
  const normalized = String(platform || '').trim().toLowerCase();
  if (normalized === 'quantumultx' || normalized === 'quanx') return 'quanx';
  if (normalized === 'loon') return 'loon';
  return 'quanx';
}

function getSectionIdentityStrategy(platform, sectionName) {
  const strategies = SECTION_IDENTITY_STRATEGIES[normalizePlatformKey(platform)];
  return (strategies && strategies[sectionName]) || 'line';
}

function getFirstField(line) {
  return line.split(',')[0].trim();
}

function getScriptIdentity(line) {
  const match = line.match(/(?:https?:\/\/|\/)[^\s,]*\.(?:js|sgmodule|plugin|js\.map)/i);
  return match ? match[0].trim() : null;
}

// first 字段中首个 = 之后的部分（如 shadowsocks=1.2.3.4:8388 → 1.2.3.4:8388），
// 无 = 时取首个空白分隔字段（如 ^https://pattern url reject → ^https://pattern）
function getFieldIdentity(firstField) {
  const idx = firstField.indexOf('=');
  const identifier = idx >= 0
    ? firstField.slice(idx + 1).trim()
    : firstField.split(/\s+/)[0].trim();
  return identifier || null;
}

function getLineIdentity(line, strategy) {
  const normalized = String(line || '').replace(/\r$/, '').trim();
  if (!normalized || normalized.startsWith('#') || normalized.startsWith(';')) return null;

  if (strategy === 'key') {
    const idx = normalized.indexOf('=');
    if (idx <= 0) return null;
    return `key:${normalized.slice(0, idx).trim().toLowerCase()}`;
  }
  if (strategy === 'script') {
    const script = getScriptIdentity(normalized);
    return script ? `script:${script}` : `line:${normalized}`;
  }

  const firstField = getFirstField(normalized);
  if (!firstField) return null;

  if (strategy === 'tag') {
    const match = normalized.match(/(?:^|,|\s)tag\s*=\s*([^,\s]+)/i);
    if (match) return `tag:${match[1].trim()}`;
    const identifier = getFieldIdentity(firstField);
    return identifier ? `field:${identifier}` : null;
  }
  if (strategy === 'afterFirstEq') {
    const identifier = getFieldIdentity(firstField);
    return identifier ? `field:${identifier}` : null;
  }
  if (strategy === 'first') {
    const idx = firstField.indexOf('=');
    const identifier = idx >= 0 ? firstField.slice(0, idx).trim() : firstField.split(/\s+/)[0].trim();
    return identifier ? `field:${identifier}` : null;
  }
  return `line:${normalized}`;
}

// 注入内容在前；原始内容中与注入条目重复的条目丢弃，其余保留
// 注释与空行不做标识匹配，仅在注入内容中已出现完全相同的行时才去重
function mergeSectionEntries(origBody, injectBody, strategy) {
  const injectIdentities = new Set();
  const injectRawLines = new Set();
  injectBody.forEach(line => {
    injectRawLines.add(line);
    const identity = getLineIdentity(line, strategy);
    if (identity) injectIdentities.add(identity);
  });
  return [
    ...injectBody,
    ...origBody.filter(line => {
      const identity = getLineIdentity(line, strategy);
      if (identity) return !injectIdentities.has(identity);
      return !injectRawLines.has(line);
    })
  ];
}

function getPlatformSections(platform) {
  return PLATFORM_SECTIONS[normalizePlatformKey(platform)];
}

// parsePlatformConf
function parsePlatformConf(confText) {
  const lines = confText.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(SECTION_RE);
    if (match) {
      // 新分区
      if (current) sections.push(current);
      current = {
        title: line,
        name: match[1].trim().toLowerCase(),
        lines: [],
        kv: [], // [{key, value, raw, isKV, isComment}]
      };
    } else if (current) {
      // 解析key-value和注释
      const kvMatch = line.match(KV_RE);
      if (kvMatch) {
        current.kv.push({
          key: kvMatch[1].trim(),
          value: kvMatch[2].trim(),
          raw: line,
          isKV: true,
          isComment: false
        });
      } else if (line.trim().startsWith('#')) {
        current.kv.push({
          key: null,
          value: null,
          raw: line,
          isKV: false,
          isComment: true
        });
      } else {
        current.kv.push({
          key: null,
          value: null,
          raw: line,
          isKV: false,
          isComment: false
        });
      }
      current.lines.push(line);
    } else {
      // 文件头部无分区内容
      if (!sections.length || sections[0].name !== '__head__') {
        sections.unshift({ title: null, name: '__head__', lines: [], kv: [] });
      }
      sections[0].lines.push(line);
      sections[0].kv.push({
        key: null,
        value: null,
        raw: line,
        isKV: false,
        isComment: line.trim().startsWith('#')
      });
    }
  }
  if (current) sections.push(current);

  // 分区唯一化，合并同名分区
  const sectionMap = {};
  const orderedSections = [];
  for (const sec of sections) {
    if (!sec.name || sec.name === '__head__') {
      orderedSections.push(sec);
      continue;
    }
    if (!sectionMap[sec.name]) {
      sectionMap[sec.name] = {
        title: sec.title,
        name: sec.name,
        lines: [],
        kv: []
      };
      orderedSections.push(sectionMap[sec.name]);
    }
    sectionMap[sec.name].lines.push(...sec.lines);
    sectionMap[sec.name].kv.push(...sec.kv);
  }

  // [general]和[mitm] key唯一，后出现的覆盖前面的
  ['general', 'mitm'].forEach(name => {
    if (sectionMap[name]) {
      const keyMap = {};
      const newKv = [];
      for (const item of sectionMap[name].kv) {
        if (item.isKV && item.key) {
          keyMap[item.key] = item; // 覆盖
        } else {
          newKv.push(item); // 注释、空行
        }
      }
      // 保持原顺序：先注释/空行，再所有key
      sectionMap[name].kv = [
        ...newKv,
        ...Object.values(keyMap)
      ];
      // lines同步
      sectionMap[name].lines = sectionMap[name].kv.map(item => item.raw);
    }
  });

  // 其余分区key-value可重复，保留全部
  return orderedSections;
}

// stringifyPlatformConf
function stringifyPlatformConf(sections) {
  return sections.map(sec => {
    if (sec.title) {
      return [sec.title, ...sec.kv.map(item => item.raw)].join('\n');
    } else {
      return sec.kv.map(item => item.raw).join('\n');
    }
  }).join('\n');
}

// 严格顺序、注释原位保留的唯一分区合并
function mergeSectionsWithOrder(origSec, injectSec) {
  if (!origSec) return injectSec;
  if (!injectSec) return origSec;
  // 构建注入key映射
  const injectKeyMap = {};
  injectSec.kv.forEach(item => {
    if (item.isKV && item.key) {
      injectKeyMap[item.key] = item;
    }
  });
  // 标记已覆盖的key
  const usedKeys = new Set();
  // 合并
  const mergedKv = origSec.kv.map(item => {
    if (item.isKV && item.key && injectKeyMap[item.key]) {
      usedKeys.add(item.key);
      return injectKeyMap[item.key]; // 用注入内容覆盖
    }
    return item; // 保留原注释、空行、未被覆盖的key
  });
  // 注入内容中有新key，追加到末尾
  for (const item of injectSec.kv) {
    if (item.isKV && item.key && !usedKeys.has(item.key)) {
      mergedKv.push(item);
      usedKeys.add(item.key);
    }
  }
  return {
    ...origSec,
    kv: mergedKv,
    lines: mergedKv.map(i => i.raw)
  };
}

// 分区内容原样保留+注入内容整体追加，且[general]/[mitm]分区key唯一，头部注释保留，新分区插入顺序
function mergeSectionsAppendWithGeneralUnique(origSections, injectSections) {
  // 构建注入分区映射
  const injectMap = {};
  injectSections.forEach(sec => {
    if (!sec.name) return;
    injectMap[sec.name] = sec;
  });
  // 记录原始分区顺序
  const origOrder = origSections.map(sec => sec.name).filter(Boolean);
  // 头部注释
  const head = origSections.find(sec => sec.name === '__head__');
  const result = [];
  if (head) result.push(head);
  const usedInject = new Set();
  // 合并原有分区
  for (let i = 0; i < origSections.length; i++) {
    const origSec = origSections[i];
    if (!origSec.name || origSec.name === '__head__') continue;
    const injectSec = injectMap[origSec.name];
    if (injectSec) {
      usedInject.add(origSec.name);
      if (origSec.name === 'general' || origSec.name === 'mitm') {
        // key唯一合并，原内容顺序保留，注入内容新key追加
        const keyMap = {};
        origSec.kv.forEach(item => {
          if (item.isKV && item.key) keyMap[item.key] = item;
        });
        injectSec.kv.forEach(item => {
          if (item.isKV && item.key) keyMap[item.key] = item;
        });
        // 保留原注释、空行和原有key顺序
        const mergedKv = origSec.kv.map(item => {
          if (item.isKV && item.key && keyMap[item.key]) {
            return keyMap[item.key];
          }
          return item;
        });
        // 注入内容中新key追加到末尾
        for (const item of injectSec.kv) {
          if (item.isKV && item.key && !origSec.kv.some(i => i.key === item.key)) {
            mergedKv.push(item);
          }
        }
        result.push({
          ...origSec,
          kv: mergedKv,
          lines: mergedKv.map(i => i.raw)
        });
      } else {
        // 其它分区内容整体追加
        result.push({
          ...origSec,
          kv: [...origSec.kv, ...injectSec.kv],
          lines: [...origSec.lines, ...injectSec.lines]
        });
      }
    } else {
      result.push(origSec);
    }
    // 检查注入内容中是否有“新分区”需要插入到本分区后面
    // 找到注入分区在注入文件中的顺序，且原始文件没有该分区
    for (let j = 0; j < injectSections.length; j++) {
      const sec = injectSections[j];
      if (!sec.name || usedInject.has(sec.name)) continue;
      // 如果注入分区在原始分区顺序中不存在，且它在注入文件中的顺序紧跟当前分区，则插入到当前分区后面
      const prevInjectIdx = j > 0 ? injectSections[j - 1].name : null;
      if (prevInjectIdx === origSec.name) {
        result.push(sec);
        usedInject.add(sec.name);
      }
    }
  }
  // 剩余未插入的新分区，全部追加到末尾
  for (const sec of injectSections) {
    if (!sec.name || usedInject.has(sec.name)) continue;
    result.push(sec);
  }
  return result;
}

function mergeConfBySectionRegex(origText, injectText, platform) {
  platform = normalizePlatformKey(platform);
  // 1. 用正则切分为分区块（严格只匹配独占一行的分区标题，保留title）
  function splitSections(text) {
    const sectionRe = /^\s*\[[^\]]+\]\s*$/gm;
    let match, lastIdx = 0, blocks = [], lastName = null, lastTitle = null;
    while ((match = sectionRe.exec(text)) !== null) {
      if (lastName !== null) {
        // 保存上一个分区
        blocks.push({
          name: lastName,
          title: lastTitle,
          body: text.slice(lastIdx, match.index)
        });
      }
      // 更新当前分区信息
      lastTitle = match[0].replace(/\r?\n$/, ''); // 保留原始分区标题
      lastName = match[0].replace(/\[|\]/g, '').trim().toLowerCase();
      lastIdx = match.index + match[0].length;
    }
    // 处理最后一个分区
    if (lastName !== null) {
      blocks.push({
        name: lastName,
        title: lastTitle,
        body: text.slice(lastIdx)
      });
    }
    // 处理文件头部（在第一个分区之前的内容）
    if (blocks.length > 0 && text.slice(0, blocks[0].title?.length) !== blocks[0].title) {
      const firstBlock = blocks[0];
      const headContent = text.slice(0, text.indexOf(firstBlock.title));
      if (headContent.trim()) {
        blocks.unshift({
          name: null,
          title: null,
          body: headContent
        });
      }
    } else if (blocks.length === 0) {
      // 整个文件没有分区
      blocks.push({
        name: null,
        title: null,
        body: text
      });
    }
    return blocks;
  }
  // 2. 构建分区名到块的映射
  const origBlocks = splitSections(origText);
  const injectBlocks = splitSections(injectText);
  const origMap = {};
  origBlocks.forEach(b => { if (b.name) origMap[b.name] = b; });
  const injectMap = {};
  injectBlocks.forEach(b => { if (b.name) injectMap[b.name] = b; });
  // 3. 文件头部注释
  const head = origBlocks.find(b => !b.name) || { body: '' };
  // 4. 合并分区，按照原始文件的顺序
  let result = [head.body];
  const seen = new Set(); // Track seen sections to avoid duplicate titles
  
  // 按照原始文件中的顺序处理分区
  for (const origBlock of origBlocks) {
    if (!origBlock.name) continue; // 跳过文件头部
    const name = origBlock.name;
    if (seen.has(name)) continue; // Skip if already processed
    seen.add(name);
    processSection(name);
  }
  
  // 处理注入文件中有但原始文件中没有的新分区
  for (const injectBlock of injectBlocks) {
    const name = injectBlock.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    processSection(name);
  }
  
  function processSection(name) {
    const origBlock = origMap[name];
    const injectBlock = injectMap[name];
    if (origBlock || injectBlock) {
      // 优先用原始分区标题，否则用注入分区标题，否则构造
      const title = (origBlock && origBlock.title) || (injectBlock && injectBlock.title) || `[${name}]`;
      const injectBody = injectBlock ? injectBlock.body.replace(/^\n+|\n+$/g, '').split('\n') : [];
      const origBody = origBlock ? origBlock.body.replace(/^\n+|\n+$/g, '').split('\n') : [];
      if (name === 'general' || name === 'mitm') {
        // 注入内容为空时直接保留原始内容
        if (!injectBlock || injectBody.every(l => l.trim() === '')) {
          if (origBody.length > 0) {
            result.push(title + '\n' + origBody.join('\n'));
          } else if (origBlock) {
            // 保留原始空分区
            result.push(title);
          }
        } else {
          // 按键名去重：同名 key 以注入内容为准，原始独有 key 保留
          const merged = mergeSectionEntries(origBody, injectBody, 'key');
          if (merged.some(l => l.trim() !== '')) {
            result.push(title + '\n' + merged.join('\n'));
          } else if (origBlock) {
            // 保留原始空分区
            result.push(title);
          }
        }
      } else {
        // 其它分区：注入内容在前，重复条目以注入内容为准
        const strategy = getSectionIdentityStrategy(platform, name);
        const merged = mergeSectionEntries(origBody, injectBody, strategy);
        if (merged.length > 0 && merged.some(l => l.trim() !== '')) {
          result.push(title + '\n' + merged.join('\n'));
        } else if (origBlock) {
          // 保留原始空分区
          result.push(title);
        }
      }
    }
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
}

module.exports = {
  parsePlatformConf,
  stringifyPlatformConf,
  getPlatformSections,
  mergeSectionsWithOrder,
  mergeSectionsAppendWithGeneralUnique,
  mergeConfBySectionRegex
}; 
