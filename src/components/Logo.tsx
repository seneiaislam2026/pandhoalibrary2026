import React from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10 w-10", showText = false }) => {
  return (
    <div className={`flex items-center gap-3`}>
      <motion.img
        src="https://i.ibb.co/b5B2gv9b/1777771470223.jpg"
        alt="পানধোয়া উন্মুক্ত পাঠাগার"
        className={`${className} object-contain rounded-full shadow-sm drop-shadow-md border-2 border-indigo-100 placeholder-slate-200`}
        referrerPolicy="no-referrer"
        initial={{ rotate: -10, scale: 0.9 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      />
      {showText && (
        <span className="font-bold text-indigo-900 tracking-tight whitespace-nowrap hidden sm:inline-block">
          পানধোয়া উন্মুক্ত পাঠাগার
        </span>
      )}
    </div>
  );
};
