module.exports = {
  root: true,
  extends: ['@react-native'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // TypeScript strict rules - per PROJECT_CONTEXT.md Section 8
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // Security: no console in production - per DEVELOPMENT_PLAYBOOK.md
    'no-console': ['error', { allow: ['warn', 'error'] }],

    // Code quality
    'no-duplicate-imports': 'error',
    'prefer-const': 'error',
    'no-var': 'error',

    // React
    'react/react-in-jsx-scope': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'babel.config.js',
    'metro.config.js',
    'jest.config.js',
  ],
};
