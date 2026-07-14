interface WaveVisualizerProps {
  className?: string;
}

const WAVE_HEIGHTS = [10, 20, 30, 14, 38, 24, 32, 14, 28, 18, 12, 34, 22, 14, 28, 18, 22];

export function WaveVisualizer({ className }: WaveVisualizerProps) {
  return (
    <div className={`flex items-end gap-1 ${className ?? ''}`}>
      {WAVE_HEIGHTS.map((height, index) => (
        <div key={index} className="w-1 rounded-full bg-(--green-400) opacity-65" style={{ height }} />
      ))}
    </div>
  );
}
