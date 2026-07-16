import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SupabaseService } from '../auth/supabase.service';
import { ChatService } from './chat.service';

// HTTP enableCors는 소켓에 안 걸리므로 게이트웨이에서 직접 CORS 지정
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly chatService: ChatService,
  ) {}

  // 핸드셰이크에서 토큰 1회 검증 → socket.data.user에 심고, 실패 시 연결 끊음
  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      socket.disconnect();
      return;
    }
    const { data, error } = await this.supabase.getUser(token);
    if (error || !data?.user) {
      socket.disconnect();
      return;
    }
    socket.data.user = data.user;
  }

  private userId(socket: Socket): string {
    return (socket.data.user as { id: string }).id;
  }

  // 방 입장 — 참여자 대조 후 socket.io room 조인
  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() socket: Socket,
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
    @ConnectedSocket() socket: Socket,
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
    @ConnectedSocket() socket: Socket,
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
