/**
 * 格式化工具函数
 */

/**
 * 格式化时间显示
 * @param ms 毫秒数
 * @returns 格式化的时间字符串
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

/**
 * 格式化速度显示
 * @param tokensPerSecond 每秒 token 数
 * @returns 格式化的速度字符串
 */
export const formatSpeed = (tokensPerSecond: number): string => {
  if (tokensPerSecond < 1000) return `${tokensPerSecond.toFixed(0)}/s`;
  return `${(tokensPerSecond / 1000).toFixed(1)}k/s`;
};

/**
 * 更准确的 token 估算
 * @param text 文本内容
 * @returns 估算的 token 数量
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;

  // 统计中文字符数量（包括中文标点符号）
  const chineseRegex = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g;
  const chineseChars = (text.match(chineseRegex) || []).length;

  // 根据标准：1 token ≈ 1.5 个中文字符，1 token ≈ 0.75 个英文单词
  const chineseTokens = Math.ceil(chineseChars / 1.5);

  // 提取英文单词并计算数量
  const englishWords = text.replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
  const englishWordCount = englishWords.length;
  const englishTokens = Math.ceil(englishWordCount / 0.75);

  return chineseTokens + englishTokens;
};