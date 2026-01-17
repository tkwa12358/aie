/**
 * 音素发音指南知识库
 * 包含20个核心音素，覆盖中国学习者最常出错的发音
 */

export interface PhonemeGuide {
  symbols: string[];        // 符号变体，如 ["θ", "th", "TH"]
  name: string;             // 名称，如 "清咬舌音"
  description: string;      // 发音说明
  examples: string[];       // 示例单词
  tip: string;              // 发音技巧
  commonMistake?: string;   // 中国学习者常见错误（可选）
}

/**
 * 音素知识库数据
 */
export const PHONEME_GUIDES: PhonemeGuide[] = [
  // === 辅音（12个）===
  {
    symbols: ['θ', 'th', 'TH'],
    name: '清咬舌音',
    description: '舌尖轻咬上下齿之间，送气',
    examples: ['think', 'three', 'bath'],
    tip: '舌尖露出牙齿，轻轻咬住',
    commonMistake: '易发成 s 或 f',
  },
  {
    symbols: ['ð', 'dh', 'DH'],
    name: '浊咬舌音',
    description: '舌尖轻咬上下齿之间，振动声带',
    examples: ['the', 'this', 'mother'],
    tip: '同上，但声带振动',
    commonMistake: '易发成 z 或 d',
  },
  {
    symbols: ['ŋ', 'ng', 'NG'],
    name: '后鼻音',
    description: '舌后部抵住软腭，气流从鼻腔出',
    examples: ['sing', 'ring', 'think'],
    tip: '像发"昂"但不张嘴',
    commonMistake: '易在后面加 g 音',
  },
  {
    symbols: ['ʃ', 'sh', 'SH'],
    name: 'sh音',
    description: '舌前部抬起接近硬腭，送气',
    examples: ['she', 'ship', 'wash'],
    tip: '像中文"诗"但更靠前',
  },
  {
    symbols: ['ʒ', 'zh', 'ZH'],
    name: '浊sh音',
    description: '舌前部抬起接近硬腭，振动声带',
    examples: ['vision', 'measure', 'treasure'],
    tip: '像 sh 但声带振动',
    commonMistake: '易发成 j 或 r',
  },
  {
    symbols: ['tʃ', 'ch', 'CH'],
    name: 'ch音',
    description: 't + ʃ 的组合',
    examples: ['church', 'check', 'watch'],
    tip: '先堵气再送出',
  },
  {
    symbols: ['dʒ', 'jh', 'JH', 'j'],
    name: 'j音',
    description: 'd + ʒ 的组合',
    examples: ['judge', 'job', 'age'],
    tip: '先堵气再送出，声带振动',
  },
  {
    symbols: ['v', 'V'],
    name: '唇齿音',
    description: '上齿轻咬下唇，振动声带',
    examples: ['very', 'have', 'love'],
    tip: '上齿咬下唇，不是双唇',
    commonMistake: '易发成 w',
  },
  {
    symbols: ['w', 'W'],
    name: '双唇音',
    description: '双唇圆拢，快速张开',
    examples: ['we', 'water', 'away'],
    tip: '像吹蜡烛起始',
  },
  {
    symbols: ['r', 'R'],
    name: '卷舌音',
    description: '舌尖卷向硬腭，但不接触',
    examples: ['red', 'run', 'car'],
    tip: '舌头卷起但不碰上腭',
    commonMistake: '与中文"日"不同',
  },
  {
    symbols: ['l', 'L'],
    name: '边音',
    description: '舌尖抵上齿龈，气流从两侧出',
    examples: ['let', 'help', 'call'],
    tip: '舌尖顶住上齿龈',
    commonMistake: '词尾 l 易吞掉',
  },
  {
    symbols: ['h', 'H', 'hh', 'HH'],
    name: '气音',
    description: '声门摩擦，送气',
    examples: ['he', 'hot', 'behind'],
    tip: '像轻轻哈气',
  },

  // === 元音（8个）===
  {
    symbols: ['æ', 'ae', 'AE'],
    name: '短a',
    description: '嘴张大，舌前部抬起',
    examples: ['cat', 'hat', 'bad'],
    tip: '嘴角向两边拉，像微笑',
    commonMistake: '易发成 e',
  },
  {
    symbols: ['ɑː', 'ɑ', 'aa', 'AA', 'a'],
    name: '长a',
    description: '嘴张大，舌后缩',
    examples: ['father', 'car', 'hot'],
    tip: '嘴张最大，说"啊"',
  },
  {
    symbols: ['ə', 'ah', 'AH', 'uh'],
    name: '弱元音',
    description: '嘴微张，舌自然放松',
    examples: ['about', 'banana', 'sofa'],
    tip: '最轻最短的"额"',
    commonMistake: '易发得太重',
  },
  {
    symbols: ['ɪ', 'ih', 'IH', 'i'],
    name: '短i',
    description: '嘴微张，舌前略抬',
    examples: ['sit', 'bit', 'is'],
    tip: '比长 i 嘴张更开',
    commonMistake: '易发成长 i',
  },
  {
    symbols: ['iː', 'iy', 'IY', 'ee'],
    name: '长i',
    description: '嘴扁平，舌前高抬',
    examples: ['see', 'be', 'eat'],
    tip: '嘴角用力向两边拉',
  },
  {
    symbols: ['ʊ', 'uh', 'UH'],
    name: '短u',
    description: '嘴略圆，舌后略抬',
    examples: ['book', 'put', 'good'],
    tip: '嘴不要太圆',
  },
  {
    symbols: ['uː', 'uw', 'UW', 'oo'],
    name: '长u',
    description: '嘴圆突，舌后高抬',
    examples: ['food', 'moon', 'two'],
    tip: '嘴唇用力向前突',
  },
  {
    symbols: ['ɜːr', 'ɜr', 'ɝ', 'er', 'ER', 'ir', 'ur', 'ər'],
    name: 'r化元音',
    description: '舌头卷起，嘴唇略圆',
    examples: ['bird', 'her', 'world'],
    tip: '先发"额"再卷舌',
    commonMistake: 'r 音不明显',
  },
];

/**
 * 根据音素符号查找发音指南
 * 支持模糊匹配（不区分大小写，支持变体）
 */
export function findPhonemeGuide(symbol: string): PhonemeGuide | undefined {
  if (!symbol) return undefined;

  const normalizedSymbol = symbol.trim().toLowerCase();

  for (const guide of PHONEME_GUIDES) {
    for (const s of guide.symbols) {
      if (s.toLowerCase() === normalizedSymbol) {
        return guide;
      }
    }
  }

  return undefined;
}
