import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { DefaultEventsMap } from 'socket.io';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../auth/supabase.service';
import { ChatService } from './chat.service';

// 핸드셰이크 미들웨어가 socket.data.user에 심는 인증 사용자 — .user 접근을 타입 안전하게.
// 이벤트 맵은 기본값 유지(emit 등 정상 동작), SocketData만 좁힌다.
type AuthedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { user: User }
>;

// HTTP enableCors는 소켓에 안 걸리므로 게이트웨이에서 직접 CORS 지정
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly chatService: ChatService,
  ) {}

  // 핸드셰이크 미들웨어로 토큰 1회 검증 → socket.data.user에 심음.
  // handleConnection(async)은 connect 완료를 못 막아, 검증 전에 도착한 chat:join이
  // socket.data.user 없이 실행되는 레이스가 있었다. 미들웨어는 next() 호출 전까지
  // connect 이벤트 자체가 발생하지 않아 이 레이스를 원천 차단한다(소켓 인증 정석).
  afterInit(server: Server) {
    // socket.io 미들웨어는 동기 콜백을 기대하므로, async 검증은 void로 감싼다
    server.use((socket, next) => {
      void (async () => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          next(new Error('인증 토큰이 없습니다.'));
          return;
        }
        const { data, error } = await this.supabase.getUser(token);
        if (error || !data?.user) {
          next(new Error('유효하지 않은 토큰입니다.'));
          return;
        }
        (socket as AuthedSocket).data.user = data.user;
        next();
      })();
    });
  }

  private userId(socket: AuthedSocket): string {
    return socket.data.user.id;
  }

  // 방 입장 — 참여자 대조 후 socket.io room 조인
  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { roomId: string },
  ) {
    await this.chatService.getRoomForParticipant(
      this.userId(socket),
      body.roomId,
    );
    await socket.join(body.roomId);
  }

  // 메시지 전송 — DB 저장 먼저 → 방 브로드캐스트(순서 고정: 저장돼야 재배포 유실 방지)
  @SubscribeMessage('chat:send')
  async onSend(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody()
    body: { roomId: string; content: string; clientMsgId: string },
  ) {
    const saved = await this.chatService.saveMessage(
      this.userId(socket),
      body.roomId,
      body.content,
    );
    // 방 전원에게 새 메시지 (clientMsgId 되실어 발신자 낙관 렌더분 중복 제거)
    this.server.to(body.roomId).emit('chat:message', {
      id: saved.id,
      roomId: saved.roomId,
      senderId: saved.senderId,
      content: saved.content,
      createdAt: saved.createdAt,
      clientMsgId: body.clientMsgId,
    });
    // 발신자에게 ack — 미전송 큐 확정 제거용
    socket.emit('chat:ack', { clientMsgId: body.clientMsgId, id: saved.id });
  }

  // 읽음 — 뷰어 커서 갱신 → 상대에게 읽음 위치 브로드캐스트(실시간 읽음 표시)
  @SubscribeMessage('chat:read')
  async onRead(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { roomId: string; lastReadMessageId: number },
  ) {
    const result = await this.chatService.markRead(
      this.userId(socket),
      body.roomId,
      body.lastReadMessageId,
    );
    this.server.to(body.roomId).emit('chat:read', result);
  }
}
