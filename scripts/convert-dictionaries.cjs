/**
 * 词库转换脚本
 * 将源词库 JSON 文件转换为标准格式并合并同类词库
 */

const fs = require('fs');
const path = require('path');

// 源目录和目标目录
const SOURCE_DIR = path.join(__dirname, '../json-full');
const TARGET_DIR = path.join(__dirname, '../backend/data/dictionary/merged');

// 词库分类配置
const DICTIONARY_CONFIG = {
  // 大学英语四六级
  'cet4': {
    name: 'CET-4 大学英语四级',
    patterns: ['CET4_'],  // 排除 CET4luan
    description: '大学英语四级核心词汇'
  },
  'cet6': {
    name: 'CET-6 大学英语六级',
    patterns: ['CET6_'],
    description: '大学英语六级核心词汇'
  },

  // 考研
  'kaoyan': {
    name: '考研英语',
    patterns: ['KaoYan_'],
    description: '考研英语核心词汇'
  },

  // 出国考试
  'toefl': {
    name: 'TOEFL 托福',
    patterns: ['TOEFL_'],
    description: '托福考试核心词汇'
  },
  'ielts': {
    name: 'IELTS 雅思',
    patterns: ['IELTS_'],
    description: '雅思考试核心词汇'
  },
  'gre': {
    name: 'GRE',
    patterns: ['GRE_'],
    description: 'GRE考试核心词汇'
  },
  'gmat': {
    name: 'GMAT',
    patterns: ['GMAT_'],
    description: 'GMAT考试核心词汇'
  },
  'sat': {
    name: 'SAT',
    patterns: ['SAT_'],
    description: 'SAT考试核心词汇'
  },
  'bec': {
    name: 'BEC 商务英语',
    patterns: ['BEC_'],
    description: '商务英语证书考试词汇'
  },

  // 专业英语
  'level4': {
    name: '专四',
    patterns: ['Level4_'],
    description: '英语专业四级词汇'
  },
  'level8': {
    name: '专八',
    patterns: ['Level8_'],
    description: '英语专业八级词汇'
  },

  // 高中
  'gaozhong': {
    name: '高中英语',
    patterns: ['GaoZhong_', 'PEPGaoZhong_', 'BeiShiGaoZhong_'],
    description: '高中英语词汇（含人教版、北师大版）'
  },

  // 初中
  'chuzhong': {
    name: '初中英语',
    patterns: ['ChuZhong_', 'PEPChuZhong7_', 'PEPChuZhong8_', 'PEPChuZhong9_', 'WaiYanSheChuZhong_'],
    description: '初中英语词汇（含人教版、外研社版）'
  },

  // 小学
  'xiaoxue': {
    name: '小学英语',
    patterns: ['PEPXiaoXue3_', 'PEPXiaoXue4_', 'PEPXiaoXue5_', 'PEPXiaoXue6_'],
    description: '小学英语词汇（人教版3-6年级）'
  }
};

/**
 * 从复杂的 JSON 格式中提取标准词条
 */
function extractWord(item) {
  const headWord = item.headWord;
  const content = item.content?.word?.content || {};

  // 提取音标
  let phonetic = content.usphone || content.ukphone || content.phone || '';
  if (phonetic && !phonetic.startsWith('/') && !phonetic.startsWith('[')) {
    phonetic = `/${phonetic}/`;
  }

  // 提取翻译
  let translation = '';
  if (content.trans && Array.isArray(content.trans)) {
    translation = content.trans.map(t => {
      const pos = t.pos ? `${t.pos}. ` : '';
      return pos + (t.tranCn || t.tran || '');
    }).join('；');
  }

  // 提取定义
  const definitions = [];
  if (content.trans && Array.isArray(content.trans)) {
    content.trans.forEach(t => {
      definitions.push({
        partOfSpeech: t.pos || '',
        definition: t.tranCn || t.tran || ''
      });
    });
  }

  // 提取例句
  let example = '';
  if (content.sentence?.sentences?.length > 0) {
    const firstSentence = content.sentence.sentences[0];
    example = firstSentence.sContent || '';
  }

  return {
    word: headWord,
    phonetic: phonetic,
    translation: translation,
    definitions: definitions,
    example: example
  };
}

/**
 * 处理单个词库类别
 */
function processDictionary(key, config) {
  console.log(`\n处理词库: ${config.name}`);

  const words = new Map(); // 使用 Map 去重

  // 获取匹配的文件
  const files = fs.readdirSync(SOURCE_DIR).filter(f => {
    if (!f.endsWith('.json') || f.startsWith('._')) return false;
    // 排除 "luan" 后缀的重复文件
    if (f.includes('luan')) return false;
    return config.patterns.some(p => f.startsWith(p));
  });

  console.log(`  找到 ${files.length} 个文件`);

  files.forEach(file => {
    const filePath = path.join(SOURCE_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.headWord) {
            const wordData = extractWord(item);
            // 使用小写单词作为 key 去重
            const wordKey = wordData.word.toLowerCase();
            if (!words.has(wordKey)) {
              words.set(wordKey, wordData);
            }
          }
        });
      }
      console.log(`    ${file}: ${data.length} 词条`);
    } catch (err) {
      console.error(`    错误处理 ${file}: ${err.message}`);
    }
  });

  const wordList = Array.from(words.values());
  console.log(`  合计: ${wordList.length} 个不重复单词`);

  return {
    id: key,
    name: config.name,
    description: config.description,
    wordCount: wordList.length,
    words: wordList
  };
}

/**
 * 主函数
 */
function main() {
  console.log('=== 词库转换工具 ===\n');
  console.log(`源目录: ${SOURCE_DIR}`);
  console.log(`目标目录: ${TARGET_DIR}`);

  // 创建目标目录
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  // 处理所有词库
  const dictionaries = [];
  const summary = [];

  for (const [key, config] of Object.entries(DICTIONARY_CONFIG)) {
    const dict = processDictionary(key, config);
    dictionaries.push(dict);
    summary.push({
      id: key,
      name: dict.name,
      description: dict.description,
      wordCount: dict.wordCount
    });

    // 保存词库文件
    const outputPath = path.join(TARGET_DIR, `${key}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(dict.words, null, 2), 'utf-8');
    console.log(`  已保存: ${outputPath}`);
  }

  // 保存索引文件
  const indexPath = path.join(TARGET_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`\n索引文件已保存: ${indexPath}`);

  // 打印汇总
  console.log('\n=== 词库汇总 ===\n');
  let totalWords = 0;
  summary.forEach(d => {
    console.log(`  ${d.name.padEnd(25)} ${String(d.wordCount).padStart(6)} 词`);
    totalWords += d.wordCount;
  });
  console.log('  ' + '-'.repeat(35));
  console.log(`  ${'总计'.padEnd(25)} ${String(totalWords).padStart(6)} 词`);
}

main();
