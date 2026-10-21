import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default [
  { ignores: ['dist/**','src-tauri/target/**','test-results/**','playwright-report/**'] },
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } }
];
