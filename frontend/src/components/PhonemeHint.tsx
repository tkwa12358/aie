import { useMemo } from 'react';
import { findPhonemeGuide, type PhonemeGuide } from '@/data/phoneme-guide';

interface PhonemeScore {
  phoneme: string;
  accuracy_score: number;
  is_correct: boolean;
}

interface PhonemeHintProps {
  phonemes: PhonemeScore[];
}

/**
 * 音素发音提示组件
 * 显示问题音素的发音说明、示例和技巧
 */
export const PhonemeHint = ({ phonemes }: PhonemeHintProps) => {
  // 过滤出问题音素并去重
  const problemGuides = useMemo(() => {
    const incorrectPhonemes = phonemes.filter(p => !p.is_correct);
    const uniqueGuides = new Map<string, { guide: PhonemeGuide; symbol: string }>();

    for (const p of incorrectPhonemes) {
      const guide = findPhonemeGuide(p.phoneme);
      if (guide && !uniqueGuides.has(guide.name)) {
        uniqueGuides.set(guide.name, { guide, symbol: p.phoneme });
      }
    }

    return Array.from(uniqueGuides.values());
  }, [phonemes]);

  // 没有问题音素或找不到指南时不显示
  if (problemGuides.length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-amber-700 mb-1.5 flex items-center gap-1">
        <span>💡</span>
        <span>发音提示:</span>
      </p>
      <div className="space-y-2">
        {problemGuides.map(({ guide, symbol }) => (
          <div
            key={guide.name}
            className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs"
          >
            {/* 标题行：符号 + 名称 */}
            <div className="font-medium text-amber-900 mb-1">
              [{symbol}] {guide.name}
            </div>

            {/* 发音说明 */}
            <div className="text-amber-800 mb-1">
              <span className="text-amber-600">发音: </span>
              {guide.description}
            </div>

            {/* 示例单词 */}
            <div className="text-amber-800 mb-1">
              <span className="text-amber-600">示例: </span>
              {guide.examples.join(', ')}
            </div>

            {/* 发音技巧 */}
            <div className="text-amber-800 mb-1">
              <span className="text-amber-600">技巧: </span>
              {guide.tip}
            </div>

            {/* 常见错误（可选） */}
            {guide.commonMistake && (
              <div className="text-red-600">
                <span className="text-red-500">常见错误: </span>
                {guide.commonMistake}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
