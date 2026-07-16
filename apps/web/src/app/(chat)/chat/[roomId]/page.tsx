import { getRoomMessages } from '@/entities/chat/chat.api';
import { getCurrentUser } from '@/entities/user/user.api';
import { ChatRoomView } from '@/features/chat/ui/ChatRoomView';

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const [messages, user] = await Promise.all([
    getRoomMessages(roomId),
    getCurrentUser(),
  ]);
  if (!user) return null; // layout이 이미 가드하지만 타입 안전용

  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-xl flex-col">
      <ChatRoomView roomId={roomId} myId={user.id} initialMessages={messages} />
    </main>
  );
}
