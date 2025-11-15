/** 测试用例配置接口 */
export interface TestCase {
  id: string;
  name: string;
  description: string;
  prompt: string;
  expectedTokens?: number; // 预期的 token 数量（可选）
  temperature?: number;
  maxTokens?: number;
  category?: string; // 测试分类
  tags?: string[]; // 标签
}

/** 测试套件配置 */
export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCases: string[]; // 测试用例 ID 数组
}

/** 测试模式 */
export type TestMode = 'sequential' | 'parallel';

/** 默认测试用例配置 */
export const DEFAULT_TEST_CASES: TestCase[] = [
  {
    id: 'short-text',
    name: '短文本生成',
    description: '生成一段简短的介绍文字',
    prompt: '请用100字左右简单介绍一下人工智能的发展历程。',
    expectedTokens: 150,
    temperature: 0.7,
    maxTokens: 200,
    category: '基础生成',
    tags: ['短文本', '介绍', 'AI']
  },
  {
    id: 'medium-text',
    name: '中等文本生成',
    description: '生成一段中等长度的技术说明',
    prompt: '请详细解释机器学习中的过拟合问题，包括产生原因、影响和解决方案，大约300字。',
    expectedTokens: 400,
    temperature: 0.7,
    maxTokens: 500,
    category: '技术解释',
    tags: ['技术', '机器学习', '解释']
  },
  {
    id: 'long-text',
    name: '长文本生成',
    description: '生成较长的分析性内容',
    prompt: '请深入分析区块链技术的优缺点，包括技术原理、应用场景、安全性和未来发展，预计500字以上。',
    expectedTokens: 700,
    temperature: 0.8,
    maxTokens: 1000,
    category: '深度分析',
    tags: ['长文本', '区块链', '分析']
  },
  {
    id: 'code-generation',
    name: '代码生成',
    description: '生成代码示例',
    prompt: '请用 Python 写一个快速排序算法的实现，并添加详细的注释说明。',
    expectedTokens: 300,
    temperature: 0.3,
    maxTokens: 400,
    category: '代码生成',
    tags: ['代码', 'Python', '算法']
  },
  {
    id: 'creative-writing',
    name: '创意写作',
    description: '创意内容生成',
    prompt: '请写一个关于时间旅行的短篇科幻故事开头，大约200字，要求有创意且引人入胜。',
    expectedTokens: 250,
    temperature: 0.9,
    maxTokens: 350,
    category: '创意写作',
    tags: ['创意', '科幻', '故事']
  },
  {
    id: 'qa-explanation',
    name: '问答解释',
    description: '问答形式的内容解释',
    prompt: '以问答的形式解释什么是量子计算，包括基本概念、工作原理、应用前景和当前挑战。',
    expectedTokens: 450,
    temperature: 0.6,
    maxTokens: 600,
    category: '问答形式',
    tags: ['问答', '量子计算', '科普']
  },
  {
    id: 'comparative-analysis',
    name: '对比分析',
    description: '对比不同方案或概念',
    prompt: '请对比分析 React 和 Vue 两个前端框架的优缺点，包括性能、生态、学习曲线和适用场景。',
    expectedTokens: 500,
    temperature: 0.7,
    maxTokens: 700,
    category: '对比分析',
    tags: ['前端', 'React', 'Vue', '对比']
  },
  {
    id: 'step-by-step',
    name: '步骤说明',
    description: '详细步骤指导',
    prompt: '请详细介绍如何部署一个基于 Node.js 的 Web 应用到云服务器，包括环境准备、代码部署、域名配置等步骤。',
    expectedTokens: 600,
    temperature: 0.5,
    maxTokens: 800,
    category: '步骤指导',
    tags: ['部署', 'Node.js', '教程']
  }
];

/** 默认测试套件配置 */
export const DEFAULT_TEST_SUITES: TestSuite[] = [
  {
    id: 'quick-test',
    name: '快速测试',
    description: '包含几个基础测试用例，适合快速验证性能',
    testCases: ['short-text', 'code-generation', 'qa-explanation']
  },
  {
    id: 'comprehensive-test',
    name: '综合测试',
    description: '包含多种类型的测试用例，全面评估性能',
    testCases: ['short-text', 'medium-text', 'code-generation', 'creative-writing', 'qa-explanation']
  },
  {
    id: 'performance-stress',
    name: '性能压力测试',
    description: '包含大量输出的测试用例，测试高负载性能',
    testCases: ['long-text', 'comparative-analysis', 'step-by-step']
  },
  {
    id: 'all-tests',
    name: '全部测试',
    description: '包含所有测试用例，最全面的性能评估',
    testCases: DEFAULT_TEST_CASES.map(tc => tc.id)
  }
];

/** 测试配置常量 */
export const TEST_CONFIG = {
  // 默认测试参数
  defaultTemperature: 0.7,
  defaultMaxTokens: 500,

  // 并发限制
  maxParallelTests: 5,

  // 超时设置
  testTimeoutMs: 300000, // 5分钟

  // 重试设置
  maxRetries: 2,
  retryDelayMs: 1000,
};

/**
 * 根据 ID 获取测试用例
 * @param id 测试用例 ID
 * @returns 测试用例或 undefined
 */
export function getTestCaseById(id: string): TestCase | undefined {
  return DEFAULT_TEST_CASES.find(tc => tc.id === id);
}

/**
 * 根据 ID 获取测试套件
 * @param id 测试套件 ID
 * @returns 测试套件或 undefined
 */
export function getTestSuiteById(id: string): TestSuite | undefined {
  return DEFAULT_TEST_SUITES.find(ts => ts.id === id);
}

/**
 * 根据分类获取测试用例
 * @param category 分类名称
 * @returns 该分类下的测试用例数组
 */
export function getTestCasesByCategory(category: string): TestCase[] {
  return DEFAULT_TEST_CASES.filter(tc => tc.category === category);
}

/**
 * 根据标签获取测试用例
 * @param tag 标签名称
 * @returns 包含该标签的测试用例数组
 */
export function getTestCasesByTag(tag: string): TestCase[] {
  return DEFAULT_TEST_CASES.filter(tc => tc.tags?.includes(tag));
}

/**
 * 获取所有可用的分类
 * @returns 分类数组
 */
export function getAllCategories(): string[] {
  const categories = DEFAULT_TEST_CASES.map(tc => tc.category).filter(Boolean);
  return [...new Set(categories)] as string[];
}

/**
 * 获取所有可用的标签
 * @returns 标签数组
 */
export function getAllTags(): string[] {
  const tags = DEFAULT_TEST_CASES.flatMap(tc => tc.tags || []).filter(Boolean);
  return [...new Set(tags)] as string[];
}