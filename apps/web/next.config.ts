import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // NEXT_PUBLIC_ 값을 빌드 시점에 서버·클라이언트 번들 양쪽에 확실히 인라인한다.
  // Amplify SSR 런타임은 process.env를 안 넘겨줘서, 이게 없으면 서버 컴포넌트에서
  // Supabase 클라이언트 생성 시 URL/Key가 undefined가 되어 500이 난다.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;
