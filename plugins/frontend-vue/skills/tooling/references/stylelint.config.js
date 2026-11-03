// Stylelint for .vue, .css and .scss: the standard rules plus the house BEM selector pattern (frontend-vue:bem-styles).
export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-html/vue'],
  rules: {
    'selector-class-pattern': [
      '^[a-z]([a-z0-9-]+)?(__([a-z0-9]+-?)+)?(--([a-z0-9]+-?)+){0,2}$',
      { message: 'Class names follow BEM: block, block__element, block--modifier (frontend-vue:bem-styles).', resolveNestedSelectors: true },
    ],
    'selector-max-id': 0,
    'declaration-no-important': true,
    'selector-max-type': [0, { ignore: ['child', 'descendant', 'compounded'], message: 'Style structure through classes, not element selectors.' }],
    'color-no-hex': [true, { message: 'Colours come from tokens (var(--…)), not hex literals.' }],
    'scss/at-rule-no-unknown': true,
  },
  overrides: [
    { files: ['**/tokens.css', '**/tokens.scss', '**/_tokens.scss'], rules: { 'color-no-hex': null } },
  ],
};
