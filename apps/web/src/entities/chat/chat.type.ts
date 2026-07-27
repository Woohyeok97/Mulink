// 채팅 메시지 1건. 백엔드 GET /chat-rooms/:id/messages 응답과 1:1.
// id는 자동증가 정수(재동기화 커서)라 number.
export type ChatMessage = {
  id: number;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string; // JSON 직렬화 ISO
};

// 채팅 목록의 방 1건. 백엔드 GET /chat-rooms 응답과 1:1.
export type ChatRoomSummary = {
  id: string;
  partner: { name: string; imageUrl: string | null };
  lastMessage: { content: string; createdAt: string } | null;
  unreadCount: number;
  createdAt: string;
};
