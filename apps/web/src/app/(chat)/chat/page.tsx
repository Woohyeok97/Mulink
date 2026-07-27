import { getMyChatRooms } from '@/entities/chat/chat.api';
import { getCurrentUser } from '@/entities/user/user.api';
import { ChatRoomList } from '@/features/chat/ui/ChatRoomList';

export default async function ChatListPage() {
  const [rooms, user] = await Promise.all([getMyChatRooms(), getCurrentUser()]);
  const isCoach = user?.role === 'COACH';

  return (
    <main className="mx-auto w-full max-w-160 px-6 pt-10 pb-20 max-[480px]:px-4">
      <h1 className="text-[22px] font-extrabold tracking-tight text-(--neutral-900)">채팅</h1>
      <p className="mt-1 mb-7 text-sm text-(--neutral-500)">
        {isCoach ? '학생들과 나눈 대화입니다' : '코치들과 나눈 대화입니다'}
      </p>
      <ChatRoomList rooms={rooms} />
    </main>
  );
}
