// check-mvmt-sync.mjs — 소비 레포용 오프라인 무결성 게이트 (mvmt-core에서 raw 벤더링됨).
//
// src/lib/mvmt/ 아래 모든 벤더 파일의 content-sha256 헤더와 본문 해시를 대조한다.
// 손으로 고친 사본(원본 우회 수정)을 빌드 단계에서 차단하는 것이 목적이다.
// 원본 최신 여부는 여기서 알 수 없다 — 그것은 mvmt-core 쪽 `npm run check`(sync --check)의 몫.
// prebuild에 걸려 있으므로 Vercel 빌드가 곧 게이트다. 실패 시 mvmt-core에서 npm run sync로 재배포할 것.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const VENDOR_DIR = path.resolve(process.cwd(), 'src/lib/mvmt');

if (!existsSync(VENDOR_DIR)) {
  console.log('check-mvmt-sync: src/lib/mvmt 없음 — 검사 대상 0건 (벤더링 미도입 레포)');
  process.exit(0);
}

const normalize = (s) => s.replace(/\r\n/g, '\n');
const sha256 = (s) => createHash('sha256').update(normalize(s)).digest('hex');

// 헤더를 떼고 본문만 남긴다. 반드시 normalize 후에 찾을 것 —
// CRLF로 체크아웃된 사본(.gitattributes 없는 레포)에서 indexOf가 -1을 반환해
// 헤더가 본문에 섞여 들어가고 게이트가 위양성으로 실패했다.
const stripHeader = (text) => {
  const norm = normalize(text);
  const end = norm.indexOf('*/\n');
  return end === -1 ? null : norm.slice(end + 3);
};

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(VENDOR_DIR);

let failures = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf-8');
  const m = /content-sha256: ([0-9a-f]{64})/.exec(text);
  if (!m) {
    console.error(`헤더 없음(벤더 파일 아님?): ${path.relative(process.cwd(), file)}`);
    failures++;
    continue;
  }
  const body = stripHeader(text);
  if (body === null) {
    console.error(`헤더가 닫히지 않음(손상된 벤더 파일): ${path.relative(process.cwd(), file)}`);
    failures++;
    continue;
  }
  if (sha256(body) !== m[1]) {
    console.error(`무결성 실패(수동 수정 감지): ${path.relative(process.cwd(), file)} — mvmt-core에서 수정 후 npm run sync`);
    failures++;
  }
}

if (failures) {
  console.error(`check-mvmt-sync 실패: ${failures}건`);
  process.exit(1);
}
console.log(`check-mvmt-sync 통과: ${files.length}개 파일 무결성 확인`);
