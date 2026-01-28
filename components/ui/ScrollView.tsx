'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollViewProps {
    children: React.ReactNode;
    className?: string;
    showArrow?: boolean;
}

export const ScrollView: React.FC<ScrollViewProps> = ({
    children,
    className,
    showArrow = true
}) => {
    const [canScroll, setCanScroll] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const checkScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isScrollable = scrollHeight > clientHeight + 1; // +1 to handle rounding issues
            const atBottom = scrollTop + clientHeight >= scrollHeight - 10; // -10 threshold

            setCanScroll(isScrollable);
            setIsAtBottom(atBottom);
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        checkScroll();

        const resizeObserver = new ResizeObserver(() => checkScroll());
        resizeObserver.observe(el);

        // Also observe the inner content if possible
        const firstChild = el.firstElementChild;
        if (firstChild) {
            resizeObserver.observe(firstChild);
        }

        return () => resizeObserver.disconnect();
    }, [children]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollTop + 100,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            <div
                ref={scrollRef}
                onScroll={checkScroll}
                className={cn("flex-1 overflow-y-auto scroll-smooth", className)}
            >
                {children}
            </div>

            {showArrow && canScroll && !isAtBottom && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 
                     bg-white/80 backdrop-blur-md border border-gray-200 
                     text-blue-600 shadow-xl rounded-full p-2.5 
                     hover:bg-blue-50 hover:scale-110 active:scale-95 
                     transition-all duration-300 animate-bounce cursor-pointer
                     group"
                    aria-label="Scroll down"
                >
                    <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                </button>
            )}
        </div>
    );
};
