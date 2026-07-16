// FE-2 채팅 메시지 유실 재현·측정 스크립트 (해결 전/후 공용).
//
// 목적: 서버 재배포(=컨테이너 재시작)로 소켓이 끊긴 사이 상대가 보낸 메시지가
//       재연결돼도 화면(수신 목록)에 안 뜨는 "유실"을 수치로 증명한다.
//
// 방법: 학생·코치 두 헤드리스 소켓 클라이언트가 같은 방에서 일정 rate로 번호 붙인
//       메시지를 주고받는 중, 지정 시점에 api 컨테이너를 docker restart 한다.
//       종료 후 "각자 보낸 번호" 대비 "상대가 받은 번호"로 유실률을 집계한다.
//
// 재현 조건(박제): 아래 CONFIG 상수. 수치는 이 조건에 의존하므로 조건을 함께 기록한다.
//
// 사용법 (컨테이너가 development로 떠 있어야 dev 엔드포인트가 열림):
//   NODE_ENV=development 로 compose 기동 후
//   node apps/api/scripts/repro-chat-loss.mjs
//
// 해결 전/후 비교: 이 스크립트는 서버·클라이언트 코드 변경 없이 그대로 재사용.
//   덩어리3(재동기화·재전송큐) 구현 후 다시 돌리면 후(after) 수치가 나온다.

import { io } from 'socket.io-client';
import { execSync } from 'node:child_process';

const API = process.env.API_URL ?? 'http://localhost:4000';
const CONTAINER = process.env.API_CONTAINER ?? 'mulink-api-1';

// ── 재현 조건 (박제) ──────────────────────────────────────────────
// 유실은 "재시작 순간 소켓이 끊긴 찰나에 상대가 보낸 메시지"에서만 나므로,
// 유실 창이 매 회 잡히도록 rate를 높이고(100ms) 재시작을 2회 준다.
const CONFIG = {
  studentNickname: '은우', // 제안이 딸린 seed 학생
  sendIntervalMs: 100, // 각 클라이언트가 메시지를 보내는 간격
  totalDurationMs: 20000, // 전체 측정 시간
  restartAtMs: [6000, 13000], // 이 시점들에 컨테이너 재시작(재배포 재현, 2회)
};
// ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, token) {
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// dev 유저 목록에서 학생을 찾고, 그 학생의 첫 제안으로 방을 만든다(코치 상대 확정).
async function setup() {
  const users = await getJson(`${API}/auth/dev/users`);
  const student = users.find((u) => u.nickname === CONFIG.studentNickname);
  if (!student) throw new Error(`학생 ${CONFIG.studentNickname} 없음 — seed 필요`);

  const studentTok = (await getJson(`${API}/auth/dev/token?userId=${student.id}`)).accessToken;

  // 학생의 첫 제안으로 방 생성(멱등) → 그 제안의 코치가 상대
  const me = await getJson(`${API}/lesson-requests/me`, studentTok);
  const proposal = me?.proposals?.[0];
  if (!proposal) throw new Error('학생에게 받은 제안이 없음 — seed 필요');

  const room = await fetch(`${API}/chat-rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentTok}` },
    body: JSON.stringify({ proposalId: proposal.id }),
  }).then((r) => r.json());

  // 방 정보로 코치 id 확보 → 코치 토큰 발급
  const coachTok = (await getJson(`${API}/auth/dev/token?userId=${room.coachId}`)).accessToken;

  return { roomId: room.id, studentTok, coachTok };
}

// 한 참여자를 나타내는 헤드리스 클라이언트. 보낸 번호·받은 번호를 기록한다.
// 앱과 동일한 해결 로직(재연결 옵션 + 재연결 시 재동기화 + 미전송 재전송 큐)을
// 넣어야 "해결 후" 수치가 나온다. 이 로직이 없으면 스크립트는 계속 유실을 보고한다.
function makeClient(label, token, roomId) {
  // 재연결 폭풍 완화: 지수 백오프(1s→5s) + 지터(0.5)
  const socket = io(API, {
    auth: { token },
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
  });
  const sent = new Set(); // 내가 보낸 seq
  const received = new Set(); // 내가 상대에게서 받은 seq
  const pending = new Map(); // clientMsgId → {content} (미ack)
  let seq = 0;
  let lastReceivedId = 0; // 재동기화 커서

  // 상대 메시지면 seq를 received에 집계 (내 에코 제외)
  const tally = (msg) => {
    const x = /^\[(\w+)#(\d+)\]/.exec(msg.content);
    if (x && x[1] !== label) received.add(Number(x[2]));
  };

  socket.on('connect', async () => {
    socket.emit('chat:join', { roomId });
    // ③ 미전송 재전송 (clientMsgId 유지 → 서버가 되실어 중복 제거)
    for (const [clientMsgId, m] of pending) {
      socket.emit('chat:send', { roomId, content: m.content, clientMsgId });
    }
    // ② 재동기화: 마지막 수신 id 초과분 조회 후 상대 메시지 집계에 반영
    try {
      const res = await fetch(
        `${API}/chat-rooms/${roomId}/messages?after=${lastReceivedId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const rows = await res.json();
        for (const msg of rows) {
          if (msg.id > lastReceivedId) lastReceivedId = msg.id;
          tally(msg);
        }
      }
    } catch {
      // 재동기화 실패는 다음 재연결에서 재시도
    }
  });

  socket.on('chat:message', (msg) => {
    if (msg.id > lastReceivedId) lastReceivedId = msg.id;
    if (msg.clientMsgId) pending.delete(msg.clientMsgId);
    tally(msg);
  });
  socket.on('chat:ack', ({ clientMsgId }) => pending.delete(clientMsgId));

  return {
    label,
    send() {
      seq += 1;
      sent.add(seq);
      const clientMsgId = `${label}-${seq}`;
      const content = `[${label}#${seq}]`;
      pending.set(clientMsgId, { content });
      socket.emit('chat:send', { roomId, content, clientMsgId });
    },
    stats: () => ({ sent, received }),
    close: () => socket.close(),
    isConnected: () => socket.connected,
  };
}

async function main() {
  console.log('재현 조건:', JSON.stringify(CONFIG));
  const { roomId, studentTok, coachTok } = await setup();
  console.log('roomId:', roomId);

  const student = makeClient('S', studentTok, roomId);
  const coach = makeClient('C', coachTok, roomId);
  await sleep(1000); // 연결·join 대기

  // 양쪽이 일정 rate로 계속 전송
  const sender = setInterval(() => {
    student.send();
    coach.send();
  }, CONFIG.sendIntervalMs);

  // 지정 시점들에 컨테이너 재시작 (재배포 재현, 여러 회)
  for (const at of CONFIG.restartAtMs) {
    setTimeout(() => {
      console.log(`\n>>> ${at}ms: docker restart ${CONTAINER} (재배포 재현)\n`);
      try {
        execSync(`docker restart ${CONTAINER}`, { stdio: 'ignore' });
      } catch (e) {
        console.error('restart 실패:', e.message);
      }
    }, at);
  }

  await sleep(CONFIG.totalDurationMs);
  clearInterval(sender);
  await sleep(3000); // 마지막 인플라이트·재동기화 정리 대기

  // 유실 집계: 내가 보낸 seq 중 상대가 못 받은 것
  const report = (fromLabel, from, toName, to) => {
    const s = from.stats().sent;
    const r = to.stats().received;
    const lost = [...s].filter((n) => !r.has(n));
    const rate = s.size ? ((lost.length / s.size) * 100).toFixed(1) : '0.0';
    console.log(
      `${fromLabel} → ${toName}: 송신 ${s.size}, 수신 ${r.size}, 유실 ${lost.length} (${rate}%)`,
    );
    return { sent: s.size, received: r.size, lost: lost.length, rate: Number(rate) };
  };

  console.log('\n=== 결과 ===');
  const sToC = report('학생(S)', student, '코치(C)', coach);
  const cToS = report('코치(C)', coach, '학생(S)', student);
  const totalSent = sToC.sent + cToS.sent;
  const totalLost = sToC.lost + cToS.lost;
  const totalRate = totalSent ? ((totalLost / totalSent) * 100).toFixed(1) : '0.0';
  console.log(`\n합계: 송신 ${totalSent}, 유실 ${totalLost}, 유실률 ${totalRate}%`);

  student.close();
  coach.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
