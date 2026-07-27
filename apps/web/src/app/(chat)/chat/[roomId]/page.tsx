import { redirect } from 'next/navigation';
import { getMyChatRooms, getRoomMessages } from '@/entities/chat/chat.api';
import { getCurrentUser } from '@/entities/user/user.api';
import { ChatRoomView } from '@/features/chat/ui/ChatRoomView';

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [messages, rooms, user] = await Promise.all([
    getRoomMessages(roomId),
    getMyChatRooms(),
    getCurrentUser(),
  ]);
  if (!user) return null; // layout이 이미 가드하지만 타입 안전용

  // 헤더용 상대 정보는 방 목록에서 꺼낸다. 내 방이 아니면 목록으로 돌려보낸다.
  const room = rooms.find(r => r.id === roomId);
  if (!room) redirect('/chat');

  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-180 flex-col">
      <ChatRoomView roomId={roomId} myId={user.id} partner={room.partner} initialMessages={messages} />
    </main>
  );
}
