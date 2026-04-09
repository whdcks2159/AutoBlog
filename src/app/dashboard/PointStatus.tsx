"use client";

interface PointStatusProps {
  points: number;
}

export default function PointStatus({ points }: PointStatusProps) {
  const isLow = points < 100;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors
      ${isLow
        ? "bg-red-50 text-red-600 border border-red-200"
        : "bg-green-50 text-green-700 border border-green-200"}`}>
      <span className="text-sm">⭐</span>
      <span>{points.toLocaleString()} P</span>
    </div>
  );
}
