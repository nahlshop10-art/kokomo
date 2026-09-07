import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SocialLink, FloatingButtonDesign } from '../types';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DEFAULT_ACTION_BUTTONS } from '../types';

interface FloatingSocialButtonsProps {
  links: SocialLink[];
  mainIcon?: string;
  config?: FloatingButtonDesign;
  isCartVisible?: boolean;
}

export function PaikarixMessageIcon({ className = "w-6 h-6 sm:w-7 sm:h-7", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.75em"
      height="1.75em"
      className={className}
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12c0 1.6.376 3.112 1.043 4.453c.178.356.237.763.134 1.148l-.595 2.226a1.3 1.3 0 0 0 1.591 1.592l2.226-.596a1.63 1.63 0 0 1 1.149.133A9.96 9.96 0 0 0 12 22m-4-8.75a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5zm-.75-2.75A.75.75 0 0 1 8 9.75h8a.75.75 0 0 1 0 1.5H8a.75.75 0 0 1-.75-.75"
      />
    </svg>
  );
}

export default function FloatingSocialButtons({ links, mainIcon, config = DEFAULT_ACTION_BUTTONS.viewCart, isCartVisible = false }: FloatingSocialButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Force left position, using View Cart's horizontal spacing values for consistency
  const isRight = false; // Always left side as requested
  
  // Extract the raw value for fallback, but if we need to calculate offset, we'll try to keep the original unit if possible.
  // The simplest reliable way for CSS is calc() if we need to offset.
  const paddingBottomCss = (isCartVisible && config.position !== 'top-center' && (config.position.includes('left') || config.position.includes('center'))) 
    ? `calc(${config.marginBottom || '24px'} + 64px)` 
    : (config.marginBottom || '24px');

  const cartMarginX = (config.marginRight && config.marginRight !== '0px' && config.marginRight !== '0') 
    ? config.marginRight 
    : ((config.marginLeft && config.marginLeft !== '0px' && config.marginLeft !== '0') ? config.marginLeft : '16px');

  const stylePositioning: React.CSSProperties = {
    bottom: paddingBottomCss,
    left: cartMarginX,
    zIndex: 60,
    transition: 'bottom 0.3s ease-in-out'
  };

  return (
    <div 
      className={cn(
        "fixed flex flex-col gap-3",
        isRight ? "items-end" : "items-center"
      )}
      style={stylePositioning}
    >
      <AnimatePresence>
        {isOpen && links && links.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.2, staggerChildren: 0.05 }}
            className={cn("flex flex-col gap-3", isRight ? "items-end" : "items-center")}
          >
            {links.map((link, i) => (
              <motion.a
                key={link.id}
                href={link.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ duration: 0.2, delay: (links.length - 1 - i) * 0.05 }}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform overflow-hidden relative"
              >
                {link.icon ? (
                  <img src={link.icon} alt="Social icon" className="w-full h-full object-contain absolute inset-0" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => {
          if (links && links.length > 0) {
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-xl flex items-center justify-center text-[#fff8f0] transition-transform active:scale-95 bg-[#29241f] border border-white/15 overflow-hidden relative cursor-pointer"
        )}
        aria-label="Contacts"
      >
        {/* Subtle shiny border highlight */}
        <span className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />

        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center text-[#fff8f0]"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center text-[#fff8f0]"
            >
              {mainIcon ? (
                <img src={mainIcon} alt="Message" className="w-full h-full object-cover" />
              ) : (
                <PaikarixMessageIcon className="w-6 h-6 sm:w-7 sm:h-7 text-[#fff8f0]" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
