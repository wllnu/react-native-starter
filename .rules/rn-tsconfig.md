---
id: rn-tsconfig
title: TypeScript compiler options
paths: tsconfig.json
when: The change edits TypeScript compiler options.
---

## rn-tsconfig/strict-flags
Severity: error
Rule: Keep `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` turned on.
Violated when: the changed lines set `strict`, `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes` to `false`, or remove one of them.
Followed when: all three options that appear in the changed lines are `true`.

Good:
```json
"compilerOptions": {
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

Bad:
```json
"compilerOptions": {
  "strict": true,
  "noUncheckedIndexedAccess": false,
  "exactOptionalPropertyTypes": true
}
```
