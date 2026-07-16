import { getMyChatRooms } from '@/entities/chat/chat.api';
import { ChatRoomList } from '@/features/chat/ui/ChatRoomList';

export default async function ChatListPage() {
  const rooms = await getMyChatRooms();
  return (
    <main className="mx-auto max-w-xl">
      <h1 className="p-4 text-lg font-semibold">채팅</h1>
      <ChatRoomList rooms={rooms} />
    </main>
  );
}
