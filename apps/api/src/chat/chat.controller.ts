import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatService } from './chat.service';
import type { CreateChatRoomDto } from './dto/create-chat-room.dto';

type AuthedRequest = { user: SupabaseUser };

@Controller('chat-rooms')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // 채팅방 생성/취득 (학생만) — 멱등
  @Post()
  async createRoom(@Req() req: AuthedRequest, @Body() dto: CreateChatRoomDto) {
    return this.chatService.createOrGetRoom(req.user.id, dto);
  }

  // 내 채팅방 목록
  @Get()
  async getMyRooms(@Req() req: AuthedRequest) {
    return this.chatService.getMyRooms(req.user.id);
  }

  // 방 메시지 — after 있으면 재동기화(그 id 초과분만), 없으면 초기 내역 전체
  @Get(':id/messages')
  async getMessages(
    @Req() req: AuthedRequest,
    @Param('id') roomId: string,
    @Query('after') after?: string,
  ) {
    if (after !== undefined) {
      return this.chatService.getMessagesAfter(
        req.user.id,
        roomId,
        Number.parseInt(after, 10),
      );
    }
    return this.chatService.getMessages(req.user.id, roomId);
  }
}
