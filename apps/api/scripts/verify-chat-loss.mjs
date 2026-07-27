// FE-2 채팅 메시지 수신 복구 검증 (개선 "후") — 실제 앱을 Playwright로 구동.
//
// 검증 내용: 서버가 죽어(docker stop) 소켓이 끊긴 "동안" 상대가 보낸 메시지가,
//   재연결(docker start) 시 "새로고침 없이" 화면에 자동 복구되는가.
//   (개선 전이라면 재연결돼도 화면에 안 뜨고, 새로고침해야 DB에서 다시 불러와 뜬다.)
//
// 왜 스크립트가 아니라 브라우저인가: 복구 로직(재연결 시 마지막 수신 ID 이후 재동기화)이
//   브라우저 앱(zustand store, resync.ts)에 있다. 실제 store가 도는 화면을 그대로 구동해
//   검증한다.
//
// 재현 방식(타이밍 싸움 회피): restart(즉시 재시작) 대신 stop→전송→start로 나눈다.
//   서버가 죽어있는 구간을 벌려놓고 그 안에서 상대가 메시지를 보내면, 그 메시지는
//   재연결 후에야 서버에 도달·복구된다 — 실서버 재배포 중 단절과 동일한 상황.
//
// 사전 조건: api 컨테이너 NODE_ENV=development(dev 로그인) + 웹 dev 서버(localhost:3000).
// 실행: node apps/api/scripts/verify-chat-loss.mjs

import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';

const API = process.env.API_URL ?? 'http://localhost:4000';
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const CONTAINER = process.env.API_CONTAINER ?? 'mulink-api-1';

const CONFIG = {
  studentNickname: '은우',
  messagesDuringOutage: 3, // 서버 죽은 동안 코치가 보낼 메시지 수
  resyncWaitMs: 12000, // start 후 재연결·재동기화가 화면을 채울 대기 시간
};

const RUN = Date.now().toString(36).slice(-4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, token) {
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function setup() {
  const users = await getJson(`${API}/auth/dev/users`);
  const student = users.find((u) => u.nickname === CONFIG.studentNickname);
  if (!student) throw new Error(`학생 ${CONFIG.studentNickname} 없음`);
  const tok = (await getJson(`${API}/auth/dev/token?userId=${student.id}`)).accessToken;
  const me = await getJson(`${API}/lesson-requests/me`, tok);
  const proposal = me?.proposals?.[0];
  if (!proposal) throw new Error('제안 없음 — seed 필요');
  const room = await fetch(`${API}/chat-rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ proposalId: proposal.id }),
  }).then((r) => r.json());
  return { roomId: room.id, studentId: student.id, coachId: room.coachId, studentTok: tok };
}

async function openRoom(browser, userId, roomId) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${API}/auth/dev/login?userId=${userId}`, { waitUntil: 'networkidle' });
  await page.goto(`${WEB}/chat/${roomId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[placeholder="메시지를 입력하세요"]', { timeout: 10000 });
  return page;
}

const hasOnScreen = (page, text) => page.evaluate((t) => document.body.innerText.includes(t), text);

async function main() {
  const { roomId, studentId, coachId, studentTok } = await setup();
  console.log('roomId:', roomId, '| RUN:', RUN);

  const browser = await chromium.launch();
  const studentPage = await openRoom(browser, studentId, roomId);
  const coachPage = await openRoom(browser, coachId, roomId);
  await sleep(1500);

  const coachInput = coachPage.locator('input[placeholder="메시지를 입력하세요"]');
  const tags = Array.from({ length: CONFIG.messagesDuringOutage }, (_, i) => `[C-${RUN}#${i + 1}]`);

  // 0) 연결 정상 확인용 메시지
  await coachInput.fill(`[C-${RUN}#0]`);
  await coachInput.press('Enter');
  await sleep(800);
  console.log('연결 정상 메시지 학생화면 표시:', await hasOnScreen(studentPage, `[C-${RUN}#0]`));

  // 1) 서버 죽이기 → 재연결 배너 확인
  console.log(`\n>>> docker stop ${CONTAINER}`);
  execSync(`docker stop ${CONTAINER}`, { stdio: 'ignore' });
  await sleep(1500);
  console.log('학생화면 재연결 배너:', (await studentPage.locator('text=재연결 중').count()) > 0);

  // 2) 서버 죽은 동안 코치가 전송 → 이 시점엔 학생화면에 없어야 함
  for (const tag of tags) {
    await coachInput.fill(tag);
    await coachInput.press('Enter');
    await sleep(200);
  }
  const during = [];
  for (const tag of tags) during.push(await hasOnScreen(studentPage, tag));
  console.log(`단절 중 코치 ${tags.length}개 전송 — 이 시점 학생화면:`, during, '(모두 false 기대)');

  // 3) 서버 살리기 → 재연결·재동기화 대기
  console.log(`\n>>> docker start ${CONTAINER}`);
  execSync(`docker start ${CONTAINER}`, { stdio: 'ignore' });
  await sleep(CONFIG.resyncWaitMs);

  // 4) 새로고침 없이 학생화면에 복구됐는지
  const recovered = [];
  for (const tag of tags) recovered.push(await hasOnScreen(studentPage, tag));

  // DB에도 저장됐는지(재전송으로 도달 확인)
  const rows = await getJson(`${API}/chat-rooms/${roomId}/messages`, studentTok);
  const inDb = tags.map((tag) => rows.some((r) => r.content === tag));

  console.log('\n=== 결과 (개선 후) ===');
  console.log('재연결 후 학생화면(새로고침 없음) 복구:', recovered, recovered.every(Boolean) ? '→ 전부 복구 ✅' : '→ 일부 미복구 ❌');
  console.log('DB 저장:', inDb);

  await browser.close();
  process.exit(recovered.every(Boolean) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
