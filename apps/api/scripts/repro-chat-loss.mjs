// FE-2 채팅 메시지 유실 재현·측정 (개선 "전").
//
// 목적: 서버 재배포(=컨테이너 재시작)로 소켓이 끊긴 사이
//   ① 상대가 보낸 메시지를 못 받는 "수신 유실"
//   ② 내가 보낸 메시지가 서버 도달조차 못 하는 "발신 유실"
//   두 가지를 수치로 증명한다.
//
// 핵심: 이 스크립트는 "저울"이다. 유실을 막는 로직(재연결 시 재동기화·미전송 재전송)을
//   일부러 하지 않는다. 그게 곧 "개선 전" 상태이며, 앱·서버 코드는 하나도 안 건드린다.
//   (개선 "후"는 실제 앱을 Playwright로 구동해 별도 측정)
//
// 실행: 컨테이너가 NODE_ENV=development로 떠 있어야 dev 엔드포인트가 열림.
//   NODE_ENV=development docker compose up -d api
//   node apps/api/scripts/repro-chat-loss.mjs

import { io } from 'socket.io-client';
import { execSync } from 'node:child_process';

const API = process.env.API_URL ?? 'http://localhost:4000';
const CONTAINER = process.env.API_CONTAINER ?? 'mulink-api-1';

// ── 재현 조건 (박제: 수치는 이 조건에 의존하므로 함께 기록한다) ──────────
const CONFIG = {
  studentNickname: '은우', // 제안이 딸린 seed 학생
  sendIntervalMs: 100, // 각 클라이언트의 전송 간격 (재시작 순간 인플라이트 확보용)
  totalDurationMs: 10000, // 전체 측정 시간
  restartAtMs: [4000, 8000], // 이 시점들에 컨테이너 재시작(재배포 재현, 2회)
};
// ────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 실행마다 고유 태그 — 같은 방에 누적된 이전 실행 메시지와 번호가 겹치지 않게 한다.
// (발신 유실을 "이번 실행 송신분이 DB에 있나"로 정확히 재기 위함)
const RUN = Date.now().toString(36).slice(-4);

async function getJson(url, token) {
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// 학생을 찾고, 그 학생의 첫 제안으로 방을 만들어(멱등) 상대 코치를 확정한다.
async function setup() {
  const users = await getJson(`${API}/auth/dev/users`);
  const student = users.find((u) => u.nickname === CONFIG.studentNickname);
  if (!student) throw new Error(`학생 ${CONFIG.studentNickname} 없음 — seed 필요`);
  const studentTok = (await getJson(`${API}/auth/dev/token?userId=${student.id}`)).accessToken;

  const me = await getJson(`${API}/lesson-requests/me`, studentTok);
  const proposal = me?.proposals?.[0];
  if (!proposal) throw new Error('학생에게 받은 제안이 없음 — seed 필요');

  const room = await fetch(`${API}/chat-rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentTok}` },
    body: JSON.stringify({ proposalId: proposal.id }),
  }).then((r) => r.json());

  const coachTok = (await getJson(`${API}/auth/dev/token?userId=${room.coachId}`)).accessToken;
  return { roomId: room.id, studentTok, coachTok };
}

// 한 참가자를 나타내는 헤드리스 클라이언트. 보낸 번호·받은 번호만 기록한다(순수 계수기).
// 재연결돼도 재동기화·재전송을 하지 않는다 = 개선 전 상태.
function makeClient(label, token, roomId) {
  // 재연결 폭풍 완화 옵션(백오프+지터)만 앱과 동일하게 둔다 — 이건 유실 복구가 아니라
  // "재접속을 흩뿌리는" 것뿐이라 개선 전/후 유실 측정에 영향을 주지 않는다.
  const socket = io(API, {
    auth: { token },
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
  });
  const sent = new Set(); // 내가 보낸 seq
  const received = new Set(); // 상대에게서 받은 seq
  let seq = 0;

  // 이번 실행(RUN)·상대 라벨의 메시지 번호만 received에 담는다(내 에코·이전 실행분 제외)
  const tally = (content) => {
    const m = new RegExp(`^\\[(\\w)-${RUN}#(\\d+)\\]`).exec(content);
    if (m && m[1] !== label) received.add(Number(m[2]));
  };

  socket.on('connect', () => {
    socket.emit('chat:join', { roomId });
    // ※ 개선 전: 여기서 재동기화(?after=)·미전송 재전송을 "하지 않는다".
  });
  socket.on('chat:message', (msg) => tally(msg.content));

  return {
    label,
    // 번호를 붙여 전송. 끊겨 있으면 이 emit은 버려진다(개선 전이라 다시 안 보냄).
    send() {
      seq += 1;
      sent.add(seq);
      socket.emit('chat:send', {
        roomId,
        content: `[${label}-${RUN}#${seq}]`,
        sendMessageKey: `${label}-${RUN}-${seq}`,
      });
    },
    stats: () => ({ sent, received }),
    close: () => socket.close(),
  };
}

async function main() {
  console.log('재현 조건:', JSON.stringify(CONFIG));
  const { roomId, studentTok, coachTok } = await setup();
  console.log('roomId:', roomId);

  const student = makeClient('S', studentTok, roomId);
  const coach = makeClient('C', coachTok, roomId);
  await sleep(1000); // 연결·join 대기

  // 양쪽이 일정 간격으로 계속 전송
  const sender = setInterval(() => {
    student.send();
    coach.send();
  }, CONFIG.sendIntervalMs);

  // 지정 시점에 컨테이너 재시작(재배포 재현)
  for (const at of CONFIG.restartAtMs) {
    setTimeout(() => {
      console.log(`\n>>> ${at}ms: docker restart ${CONTAINER}\n`);
      try {
        execSync(`docker restart ${CONTAINER}`, { stdio: 'ignore' });
      } catch (e) {
        console.error('restart 실패:', e.message);
      }
    }, at);
  }

  await sleep(CONFIG.totalDurationMs);
  clearInterval(sender);
  await sleep(3000); // 마지막 인플라이트 정리 대기

  // ── 집계 ──────────────────────────────────────────────
  // 서버 DB에 실제 저장된 메시지 번호(발신 유실 대조용)
  const dbRows = await getJson(`${API}/chat-rooms/${roomId}/messages`, studentTok);
  const savedSeq = { S: new Set(), C: new Set() };
  const runRe = new RegExp(`^\\[(\\w)-${RUN}#(\\d+)\\]`);
  for (const row of dbRows) {
    const m = runRe.exec(row.content);
    if (m) savedSeq[m[1]]?.add(Number(m[2]));
  }

  // ① 수신 유실: 내가 보낸 것 중 상대가 못 받은 번호
  const recvLoss = (from, to) => {
    const s = from.stats().sent;
    const r = to.stats().received;
    const lost = [...s].filter((n) => !r.has(n));
    return { sent: s.size, recv: r.size, lost: lost.length };
  };
  // ② 발신 유실: 내가 보냈다고 기록한 것 중 서버 DB에 없는 번호
  const sendLoss = (from) => {
    const s = from.stats().sent;
    const saved = savedSeq[from.label];
    const lost = [...s].filter((n) => !saved.has(n));
    return { sent: s.size, saved: saved.size, lost: lost.length };
  };

  const pct = (lost, total) => (total ? ((lost / total) * 100).toFixed(1) : '0.0');

  console.log('\n=== 결과 (개선 전) ===');

  console.log('\n[① 수신 유실] 상대가 보낸 걸 내가 못 받은 것');
  const sToC = recvLoss(student, coach); // 학생→코치
  const cToS = recvLoss(coach, student); // 코치→학생
  console.log(`  학생→코치: 송신 ${sToC.sent}, 수신 ${sToC.recv}, 유실 ${sToC.lost} (${pct(sToC.lost, sToC.sent)}%)`);
  console.log(`  코치→학생: 송신 ${cToS.sent}, 수신 ${cToS.recv}, 유실 ${cToS.lost} (${pct(cToS.lost, cToS.sent)}%)`);
  const recvTotalSent = sToC.sent + cToS.sent;
  const recvTotalLost = sToC.lost + cToS.lost;
  console.log(`  → 수신 유실률: ${recvTotalLost}/${recvTotalSent} = ${pct(recvTotalLost, recvTotalSent)}%`);

  console.log('\n[② 발신 유실] 내가 보낸 게 서버 DB에 도달 못 한 것');
  const sSend = sendLoss(student);
  const cSend = sendLoss(coach);
  console.log(`  학생: 송신 ${sSend.sent}, DB저장 ${sSend.saved}, 유실 ${sSend.lost} (${pct(sSend.lost, sSend.sent)}%)`);
  console.log(`  코치: 송신 ${cSend.sent}, DB저장 ${cSend.saved}, 유실 ${cSend.lost} (${pct(cSend.lost, cSend.sent)}%)`);
  const sendTotalSent = sSend.sent + cSend.sent;
  const sendTotalLost = sSend.lost + cSend.lost;
  console.log(`  → 발신 유실률: ${sendTotalLost}/${sendTotalSent} = ${pct(sendTotalLost, sendTotalSent)}%`);

  student.close();
  coach.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
