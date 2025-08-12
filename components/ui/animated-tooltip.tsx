// File: components/ui/animated-tooltip.tsx
"use client";
import React, { useState } from "react";
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { cn } from "@/lib/utils";

// Tipe Item sekarang harus mencakup isCompleted
type Item = {
  id: number;
  name: string;
  designation: string;
  image?: string;
  icon?: React.ElementType;
  isCurrent?: boolean;
  isCompleted?: boolean;
  isClickable?: boolean;
  onClick?: () => void;
};

export const AnimatedTooltip = ({ items }: { items: Item[] }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);
  const rotate = useSpring(useTransform(x, [-100, 100], [-45, 45]), springConfig);
  const translateX = useSpring(useTransform(x, [-100, 100], [-50, 50]), springConfig);
  
  const handleMouseEnter = (item: Item) => {
    setHoveredIndex(item.id);
  };
  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <>
      {items.map((item) => (
        // --- PERUBAHAN: Hapus `-mr-4` dan tambahkan styling untuk layout vertikal ---
        <div
          className="relative group" // Dulu: "-mr-4 relative group"
          key={item.name}
          onMouseEnter={() => handleMouseEnter(item)}
          onMouseLeave={handleMouseLeave}
          onClick={item.onClick}
        >
          <AnimatePresence>
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 10 } }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                style={{ translateX: translateX, rotate: rotate, whiteSpace: "nowrap" }}
                className="absolute -top-16 -left-1/2 translate-x-1/2 flex text-xs flex-col items-center justify-center rounded-md bg-black z-50 shadow-xl px-4 py-2"
              >
                <div className="absolute inset-x-10 z-30 w-[20%] -bottom-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent h-px " />
                <div className="absolute left-10 w-[40%] z-30 -bottom-px bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px " />
                <div className="font-bold text-white relative z-30 text-base">{item.name}</div>
                <div className="text-white text-xs">{item.designation}</div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* --- PERUBAHAN: Styling lebih eksplisit untuk ikon/avatar --- */}
          <div
            className={cn(
              "flex items-center gap-4 transition-all duration-300",
              item.isClickable && !item.isCurrent ? "group-hover:pl-2" : ""
            )}
          >
            <div
              className={cn(
                "object-cover !m-0 !p-0 object-top rounded-full h-12 w-12 border-2 transition-all duration-300 flex items-center justify-center shrink-0",
                item.isCurrent ? "border-red-500 bg-white" : "",
                item.isCompleted ? "border-red-600 bg-red-600" : "",
                !item.isCurrent && !item.isCompleted ? "border-gray-500 bg-gray-700" : "",
                item.isClickable ? "cursor-pointer group-hover:border-white" : "cursor-default opacity-60"
              )}
            >
              {item.icon && React.createElement(item.icon, { 
                  className: cn("h-6 w-6 transition-colors",
                    item.isCompleted ? "text-white" : "",
                    item.isCurrent ? "text-red-600" : "text-gray-400"
                  )
              })}
            </div>
            {/* Tampilkan teks di samping ikon */}
          </div>
        </div>
      ))}
    </>
  );
};