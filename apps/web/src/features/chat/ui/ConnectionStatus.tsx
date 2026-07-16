export function ConnectionStatus({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="bg-(--neutral-100) py-1 text-center text-xs text-(--neutral-500)">
      연결이 끊겨 재연결 중…
    </div>
  );
}
