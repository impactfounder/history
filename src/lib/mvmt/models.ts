/**
 * AUTO-GENERATED — DO NOT EDIT. 원본: mvmt-core/models.ts
 * 이 파일을 직접 고치면 CI(check-mvmt-sync)가 실패한다. mvmt-core에서 수정 후 npm run sync.
 * origin-commit: 332ed1c  content-sha256: b25cc36cf75a7584b2919cf3e3b51dbd17220e576a70bbcbb8d90c43b18f7b79
 */
export const CLAUDE_MODEL_IDS = {
  haiku45: 'claude-haiku-4-5-20251001',
  sonnet46: 'claude-sonnet-4-6',
  sonnet5: 'claude-sonnet-5',
  opus48: 'claude-opus-4-8',
} as const;

export type ClaudeModelKey = keyof typeof CLAUDE_MODEL_IDS;
export type ClaudeModelId = (typeof CLAUDE_MODEL_IDS)[ClaudeModelKey];

// 권고 별칭 — 신규 코드용. 기존 코드의 별칭 전환은 모델 변경(비용·동작 변화)이므로 개별 승인 후.
export const CLAUDE_MODEL_ALIASES = {
  fast: CLAUDE_MODEL_IDS.haiku45,
  standard: CLAUDE_MODEL_IDS.sonnet5,
  deep: CLAUDE_MODEL_IDS.opus48,
} as const;
