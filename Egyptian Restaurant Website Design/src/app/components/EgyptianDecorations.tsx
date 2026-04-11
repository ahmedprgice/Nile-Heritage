import { motion } from 'motion/react';

// Eye of Horus SVG Component
export function EyeOfHorus({ className = "w-12 h-12", animate = true }: { className?: string; animate?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={className}
      initial={animate ? { opacity: 0, scale: 0 } : {}}
      animate={animate ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.8 }}
    >
      <g fill="currentColor">
        <path d="M50 35c-15 0-28 8-35 20 7 12 20 20 35 20s28-8 35-20c-7-12-20-20-35-20zm0 33c-7 0-13-6-13-13s6-13 13-13 13 6 13 13-6 13-13 13z"/>
        <circle cx="50" cy="55" r="8"/>
        <path d="M85 55c0 2-1 3-2 3H17c-1 0-2-1-2-3s1-3 2-3h66c1 0 2 1 2 3z"/>
        <path d="M15 58l-5 12c-1 2 0 4 2 5l8-17h-5zm70 0l5 12c1 2 0 4-2 5l-8-17h5z"/>
      </g>
    </motion.svg>
  );
}

// Ankh Symbol
export function AnkhSymbol({ className = "w-8 h-8", animate = true }: { className?: string; animate?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={className}
      initial={animate ? { rotate: -180, opacity: 0 } : {}}
      animate={animate ? { rotate: 0, opacity: 1 } : {}}
      transition={{ duration: 1 }}
    >
      <g fill="currentColor" stroke="currentColor" strokeWidth="2">
        <circle cx="50" cy="25" r="15" fill="none"/>
        <line x1="50" y1="40" x2="50" y2="90" strokeWidth="8"/>
        <line x1="30" y1="55" x2="70" y2="55" strokeWidth="8"/>
      </g>
    </motion.svg>
  );
}

// Lotus Flower
export function LotusFlower({ className = "w-12 h-12", animate = true }: { className?: string; animate?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={className}
      initial={animate ? { scale: 0, rotate: -45 } : {}}
      animate={animate ? { scale: 1, rotate: 0 } : {}}
      transition={{ duration: 1, type: "spring" }}
    >
      <g fill="currentColor">
        <ellipse cx="50" cy="70" rx="8" ry="25"/>
        <ellipse cx="35" cy="65" rx="8" ry="25" transform="rotate(-25 35 65)"/>
        <ellipse cx="65" cy="65" rx="8" ry="25" transform="rotate(25 65 65)"/>
        <ellipse cx="25" cy="55" rx="6" ry="20" transform="rotate(-45 25 55)"/>
        <ellipse cx="75" cy="55" rx="6" ry="20" transform="rotate(45 75 55)"/>
        <circle cx="50" cy="50" r="10"/>
        <rect x="47" y="75" width="6" height="20" rx="3"/>
      </g>
    </motion.svg>
  );
}

// Scarab Beetle
export function Scarab({ className = "w-12 h-12", animate = true }: { className?: string; animate?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={className}
      initial={animate ? { y: -20, opacity: 0 } : {}}
      animate={animate ? { y: 0, opacity: 1 } : {}}
      transition={{ duration: 0.8 }}
    >
      <g fill="currentColor">
        <ellipse cx="50" cy="50" rx="30" ry="25"/>
        <ellipse cx="50" cy="35" rx="20" ry="15"/>
        <circle cx="40" cy="32" r="3"/>
        <circle cx="60" cy="32" r="3"/>
        <line x1="30" y1="45" x2="15" y2="50" stroke="currentColor" strokeWidth="4"/>
        <line x1="70" y1="45" x2="85" y2="50" stroke="currentColor" strokeWidth="4"/>
        <line x1="30" y1="55" x2="15" y2="60" stroke="currentColor" strokeWidth="4"/>
        <line x1="70" y1="55" x2="85" y2="60" stroke="currentColor" strokeWidth="4"/>
        <line x1="35" y1="65" x2="25" y2="75" stroke="currentColor" strokeWidth="4"/>
        <line x1="65" y1="65" x2="75" y2="75" stroke="currentColor" strokeWidth="4"/>
      </g>
    </motion.svg>
  );
}

// Papyrus Border Pattern
export function PapyrusBorder({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="w-full h-4" preserveAspectRatio="none" viewBox="0 0 1000 20">
        <pattern id="papyrusPattern" x="0" y="0" width="50" height="20" patternUnits="userSpaceOnUse">
          <path d="M0,10 L12,5 L25,10 L37,5 L50,10" stroke="currentColor" fill="none" strokeWidth="2"/>
          <path d="M0,15 L12,12 L25,15 L37,12 L50,15" stroke="currentColor" fill="none" strokeWidth="1" opacity="0.5"/>
        </pattern>
        <rect width="1000" height="20" fill="url(#papyrusPattern)"/>
      </svg>
    </div>
  );
}

// Hieroglyphic Divider
export function HieroglyphicDivider({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`flex items-center justify-center gap-4 ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <AnkhSymbol className="w-6 h-6 text-primary" animate={false} />
      <div className="h-px bg-primary flex-1 max-w-[200px]" />
      <EyeOfHorus className="w-8 h-8 text-primary" animate={false} />
      <div className="h-px bg-primary flex-1 max-w-[200px]" />
      <LotusFlower className="w-6 h-6 text-primary" animate={false} />
    </motion.div>
  );
}

// Egyptian Column
export function EgyptianColumn({ side = "left" }: { side?: "left" | "right" }) {
  return (
    <motion.div
      className={`absolute ${side === "left" ? "left-0" : "right-0"} top-0 bottom-0 w-16 hidden lg:block pointer-events-none`}
      initial={{ opacity: 0, x: side === "left" ? -50 : 50 }}
      whileInView={{ opacity: 0.1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1 }}
    >
      <svg viewBox="0 0 100 1000" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <pattern id="columnPattern" x="0" y="0" width="100" height="50" patternUnits="userSpaceOnUse">
            <rect x="10" y="0" width="80" height="50" fill="currentColor" opacity="0.3"/>
            <line x1="20" y1="0" x2="20" y2="50" stroke="currentColor" strokeWidth="1"/>
            <line x1="80" y1="0" x2="80" y2="50" stroke="currentColor" strokeWidth="1"/>
          </pattern>
        </defs>
        {/* Column capital (lotus-shaped) */}
        <path d="M20,0 L20,50 L10,80 L0,100 L100,100 L90,80 L80,50 L80,0 Z" fill="currentColor" opacity="0.2"/>
        {/* Column shaft */}
        <rect x="25" y="100" width="50" height="850" fill="url(#columnPattern)"/>
        {/* Column base */}
        <rect x="10" y="950" width="80" height="50" fill="currentColor" opacity="0.2"/>
      </svg>
    </motion.div>
  );
}

// Cartouche Frame (for names/titles)
export function Cartouche({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative inline-block ${className}`}>
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path
          d="M20,10 L80,10 Q90,10 90,20 L90,80 Q90,90 80,90 L20,90 Q10,90 10,80 L10,20 Q10,10 20,10 Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        <rect x="5" y="45" width="3" height="10" fill="currentColor"/>
        <rect x="92" y="45" width="3" height="10" fill="currentColor"/>
      </svg>
      <div className="relative z-10 px-8 py-4">
        {children}
      </div>
    </div>
  );
}

// Sun Disk (Ra symbol)
export function SunDisk({ className = "w-16 h-16", animate = true }: { className?: string; animate?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={className}
      initial={animate ? { rotate: 0 } : {}}
      animate={animate ? { rotate: 360 } : {}}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    >
      <circle cx="50" cy="50" r="25" fill="currentColor"/>
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const x1 = 50 + Math.cos(angle) * 30;
        const y1 = 50 + Math.sin(angle) * 30;
        const x2 = 50 + Math.cos(angle) * 45;
        const y2 = 50 + Math.sin(angle) * 45;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
    </motion.svg>
  );
}

// Pyramid Pattern Background
export function PyramidPattern() {
  return (
    <div className="absolute inset-0 opacity-5 pointer-events-none">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pyramid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M40,0 L80,80 L0,80 Z" fill="currentColor" opacity="0.3"/>
            <path d="M40,10 L70,70 L10,70 Z" fill="none" stroke="currentColor" strokeWidth="1"/>
            <path d="M40,20 L60,60 L20,60 Z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pyramid)"/>
      </svg>
    </div>
  );
}
