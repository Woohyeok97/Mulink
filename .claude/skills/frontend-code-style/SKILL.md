---
name: frontend-code-style
description: frontend 코드를 작성/수정/리팩토링할 때 항상 참고하는 코드 스타일 가이드. 명확한 네이밍, 가독성 좋은 코드를 위한 선호 패턴 카탈로그. 새 파일 작성, 함수 추가, 기존 코드 수정 시 자동 발동.
---

# 코드 스타일 가이드

이 카탈로그에 정의된 선호 패턴을 따를 것.
새 코드 작성, 기존 코드 수정, 리팩토링 모든 경우에 적용.

## 적용 방식

- 코드 작성 전 관련된 패턴이 있는지 확인
- 코드 작성 중 패턴을 따르는지 점검
- 작성 후 자가 검토 시 카탈로그와 대조

---

## 선호 패턴 카탈로그

### CS-1: React/라이브러리 훅은 네임스페이스 없이 직접 임포트

**원칙**: `React.useState()` 같은 네임스페이스 호출 대신, 필요한 훅을 직접 임포트해서 사용.

```tsx
import { useState, useEffect } from 'react';

function Component() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    /* ... */
  }, []);
}
```

**이유**: 트리 쉐이킹 친화적이고, 코드가 짧아지고, React 커뮤니티의 관용적 스타일.

---

### CS-2: map/filter 콜백 파라미터는 의미 있는 풀네임으로

**원칙**: `arr.map(d => ...)`처럼 한 글자 약어 쓰지 말 것. 변수의 역할이 코드에서 즉시 파악되어야 함.

```tsx
{
  designs.map(design => <DesignCard key={design.id} design={design} />);
}

{
  users.filter(user => user.active).map(user => <UserRow user={user} />);
}
```

**예외**: 인덱스는 'indext', 진짜 의미 없는 좌표는 `x`, `y` 허용. 단 도메인 객체는 절대 한 글자 금지.

**이유**: 한 글자 변수는 읽을 때마다 "이게 뭐였지?"를 다시 생각하게 만듦.

---

### CS-3: 파일 내 컴포넌트 배치 순서 — 메인 컴포넌트를 상단에

**원칙**: 하나의 파일에 여러 컴포넌트가 있을 때, 메인(export default) 컴포넌트를 파일 상단에 먼저 배치하고 분리된 서브 컴포넌트는 아래에 배치.

```tsx
// 메인 컴포넌트를 먼저
export default async function ProfilePage({ params }: { params: Params }) {
  return (
    <div>
      <PurchaseList purchases={purchases} />
    </div>
  );
}

// 서브 컴포넌트는 아래에
function PurchaseList({ purchases }: { purchases: PurchaseItem[] }) {
  return <ul>{/* ... */}</ul>;
}
```

**이유**: 파일을 열었을 때 "이 파일이 무엇을 하는 파일인가"가 첫 줄에서 바로 보여야 함. 서브 컴포넌트를 먼저 보여주면 맥락 없이 세부 구현부터 읽게 되어 파악 속도가 느려짐.

---

### CS-4: useMutation 래핑 — 훅으로 캡슐화하고 콜백은 옵션으로 전달

**원칙**: `useMutation`을 컴포넌트에 직접 쓰지 않고, `use[Feature]Mutation` 훅으로 래핑해서 사용. 성공/실패 콜백(`onSuccess`, `onError`)은 훅 호출 시 옵션으로 주입.

```tsx
// design-create.mutate.ts — 뮤테이션 훅 정의
type CreateDesignMutationOptions = UseMutationOptions<
  CreateDesignResult, // mutation 결과 타입
  Error, // error 타입
  DesignCreateFormType // mutation 파라미터 타입
>;

export function useCreateDesignMutation(options?: CreateDesignMutationOptions) {
  return useMutation({
    mutationFn: createDesign,
    ...options
  });
}

// DesignCreateForm.tsx — 컴포넌트에서 사용
const { mutate, isPending, isError, error } = useCreateDesignMutation({
  onSuccess: ({ designId }) => router.push(`/designs/${designId}`)
});
```

**이유**: 뮤테이션 로직(API 호출, 에러 처리)과 UI 부수효과(라우팅, 토스트)를 분리할 수 있음. 컴포넌트는 "성공 시 어디로 갈지"만 알면 되고, 훅은 "어떻게 요청할지"만 담당.

---

<!-- 새 패턴은 여기 아래에 CS-5, CS-6, ... 형식으로 추가 -->

---

## 카탈로그 외 일반 원칙

위 구체 사례가 없어도 다음 원칙을 따를 것:

- **명확한 네이밍**: 변수/함수/컴포넌트는 역할이 즉시 파악되는 이름
- **관용적 패턴 우선**: 라이브러리/프레임워크의 일반적 사용 스타일을 따를 것
- **자기 설명적 코드**: 주석 없이도 읽히는 코드가 우선, 주석은 "왜"를 설명할 때만
