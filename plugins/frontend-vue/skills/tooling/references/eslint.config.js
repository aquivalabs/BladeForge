// ESLint flat config for a Vue 3 + TypeScript project. Prettier owns formatting; this file owns correctness and the house style.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } },
  },
  {
    rules: {
      // frontend-js:conventions
      'prefer-arrow-callback': 'error',
      'func-style': ['error', 'expression'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'curly': ['error', 'all'],
      'id-length': ['error', { min: 3, exceptions: ['id', 'to', 'at', 'on', 'of', 'in', 'is', 'el', 'e'] }],
      'no-restricted-imports': ['error', { patterns: [{ group: ['../../*'], message: 'Use a registered @ alias instead of climbing with ../../.' }] }],
      // frontend-vue:sfc-conventions
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/define-macros-order': ['error', { order: ['defineProps', 'defineEmits', 'defineModel', 'defineSlots'] }],
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/no-v-html': 'error',
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  prettier,
);
