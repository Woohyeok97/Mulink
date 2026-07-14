// BE-1 세션코드 유실 장애 재현·측정 스크립트.
// nginx(8080)를 통해 "발급 → 교환"을 N회 반복하며 실패율을 잰다.
// 발급/교환이 round-robin으로 다른 서버에 갈라지면 Map 버전은 교환이 실패한다.
//
// 실행: node scripts/repro-session-code.mjs
// (기본 100회, 대상 http://localhost:8080 — 환경변수 N, BASE_URL로 조정 가능)

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const N = Number(process.env.N ?? 100);
// 동시에 진행하는 로그인 수. 여러 유저가 동시에 로그인하는 실제 트래픽을 흉내내
// 발급/교환 요청이 뒤섞이게 만든다 → 발급≠교환 서버가 확률적으로 절반 발생.
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);

// 한 번의 발급→교환 사이클. 성공 여부와 두 요청을 처리한 서버를 돌려준다.
async function runOnce() {
  const issue = await (await fetch(`${BASE_URL}/auth/repro/issue`)).json();
  const exchange = await (
    await fetch(
      `${BASE_URL}/auth/repro/exchange?code=${encodeURIComponent(issue.code)}`,
    )
  ).json();

  return {
    ok: exchange.ok,
    issuedBy: issue.instance,
    exchangedBy: exchange.instance,
  };
}

async function main() {
  let success = 0;
  let splitFail = 0; // 발급 서버 ≠ 교환 서버라서 실패한 경우 (재현하려는 바로 그 장애)

  // N회를 CONCURRENCY개씩 묶어 동시에 실행 → 요청들이 뒤섞인다
  for (let done = 0; done < N; done += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, N - done);
    const results = await Promise.all(
      Array.from({ length: batch }, () => runOnce()),
    );
    for (const { ok, issuedBy, exchangedBy } of results) {
      if (ok) success++;
      else if (issuedBy !== exchangedBy) splitFail++;
    }
  }

  const fail = N - success;
  const failRate = ((fail / N) * 100).toFixed(1);

  console.log(`대상: ${BASE_URL}`);
  console.log(`총 ${N}회 | 성공 ${success} | 실패 ${fail}`);
  console.log(`실패율: ${failRate}%`);
  console.log(`  └ 발급≠교환 서버로 갈려 실패: ${splitFail}건`);
}

void main();
