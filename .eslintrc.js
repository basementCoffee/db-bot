module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: ['google'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    requireConfigFile: false,
  },
  rules: {
    'linebreak-style': 'off',
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'max-len': [
      'error',
      {
        code: 120,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
    'require-jsdoc': 'off',
    'valid-jsdoc': [
      'error',
      {
        requireReturn: false,
        requireParamType: false,
        prefer: {return: 'returns'},
        requireReturnDescription: false,
      },
    ],
    'camel-case': 'off',
    'prefer-const': [
      'error',
      {
        ignoreReadBeforeAssign: true,
      },
    ],
  },
};
