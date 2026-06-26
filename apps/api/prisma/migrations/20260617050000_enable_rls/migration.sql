-- RLS 활성화: 정책(policy)은 만들지 않는다.
-- NestJS + Prisma는 높은 권한 역할로 접속해 RLS를 우회하므로 정상 동작하고,
-- Supabase가 자동 노출하는 공개 Data API는 외부에서 차단된다.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonRequest" ENABLE ROW LEVEL SECURITY;
