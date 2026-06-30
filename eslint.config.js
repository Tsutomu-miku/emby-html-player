// ESLint flat config
// 规范来源：AGENTS.md §1 单文件 ≤300 行；§2 禁止兼容性代码
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  // 全局忽略
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**', 'electron/main/index.js', 'electron/preload/index.js'],
  },

  // React hooks 规则：rules-of-hooks 开 error，exhaustive-deps 开 warn（有理由时可 disable），
  // set-state-in-effect 关闭（React 18/19 下 setState-in-effect 是常规模式，需等 React 19 useEvent 再考虑启用）
  {
    name: 'react-hooks',
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // JS/TS 基础规则
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.js',
            'postcss.config.js',
            'tailwind.config.js',
            'scripts/*.mjs',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 项目特定规则
  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.{ts,tsx}'],
    rules: {
      // ===== AGENTS.md §1：单文件 ≤ 300 行 =====
      // 硬上限 300，特殊情况下可文件顶部 /* eslint-disable max-lines */ 绕过（仍 ≤400 行）
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      // 单函数 ≤ 200 行：避免巨石函数，但允许完整 React 组件保持内聚
      'max-lines-per-function': ['error', { max: 200, skipBlankLines: true, skipComments: true, IIFEs: true }],

      // ===== AGENTS.md §2：禁止兼容性代码 =====
      'no-empty': ['error', { allowEmptyCatch: false }], // catch 不能空
      'no-empty-pattern': 'error',
      'no-useless-catch': 'error', // 不要 catch 后又原样 throw
      '@typescript-eslint/no-explicit-any': 'error', // 禁 any，用 unknown + 类型守卫
      '@typescript-eslint/no-non-null-assertion': 'error', // 禁 a!，用类型守卫
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error', // 漂浮的 Promise 必须处理
      '@typescript-eslint/require-await': 'error', // async 函数必须有 await
      'no-implicit-coercion': ['error', { allow: ['!!'] }], // 禁 +'' / ~等隐式转换；!! 允许
      'no-return-await': 'error',

      // ===== 通用质量 =====
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-unused-vars': 'off', // 由 ts-eslint 接管
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],

      // ===== React / JSX 习惯（无 eslint-plugin-react，仅基础） =====
      'jsx-quotes': ['error', 'prefer-double'],
    },
  },

  // 配置文件、脚本放宽（这些文件天然短小但可能用 any / console）
  {
    files: ['*.config.{ts,js,mjs,cjs}', 'vite.config.ts', 'eslint.config.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'no-console': 'off',
    },
  },
)
