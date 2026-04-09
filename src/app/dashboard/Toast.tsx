"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export default function Toast({ message, visible, onHide }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, 3500);
    return () => clearTimeout(t);
  }, [visible, onHide]);

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300
      ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"}`}>
      <div className="bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2.5 whitespace-nowrap">
        <span className="text-base">✅</span>
        {message}
      </div>
    </div>
  );
}
