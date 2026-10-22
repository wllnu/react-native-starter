// Shared ESLint message → rule-ID mapping so every check (verify, on-edit guard) prints failures
// the same way: `rule-id: file:line message`, with IDs from .rules/.
//
//   import { mapEslint } from './lib/eslint-ids.mjs';
//   mapEslint(eslintMessage) → [ruleId, message]

// ESLint: keep rule IDs the lint rules put in their messages, map well-known rules to rule IDs, otherwise namespace as eslint/*.
const ESLINT_MAP = {
  '@typescript-eslint/no-floating-promises': 'rn-testing/await-rntl',
  'react/no-array-index-key': 'rn-ui/stable-list-keys',
  'no-console': 'rn-security/no-sensitive-logs',
};
// no-restricted-imports and import/no-restricted-paths put their own text before our message, so the ID can sit mid-message.
const RN_ID_ANYWHERE = /(?:^|\s)(rn-[\w-]+\/[\w-]+):\s*/;
function mapEslint(m) {
  const hit = RN_ID_ANYWHERE.exec(m.message);
  if (hit) return [hit[1], m.message.slice(hit.index + hit[0].length)];
  return [ESLINT_MAP[m.ruleId] || (m.ruleId ? `eslint/${m.ruleId}` : 'eslint/parse'), m.message];
}

export { mapEslint };