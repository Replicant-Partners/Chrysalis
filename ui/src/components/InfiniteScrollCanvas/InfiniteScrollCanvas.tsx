/**
 * Infinite Scroll Canvas - Wrapper for infinite scrolling in chosen direction
 */

import React, { useRef, useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize } from 'lucide-react';
import { Button } from '../design-system';
import styles from './InfiniteScrollCanvas.module.css';

type ScrollMode = 'vertical' | 'horizontal' | 'both' | 'bounded';

interface InfiniteScrollCanvasProps {
  children: React.ReactNode;
  scrollMode?: ScrollMode;
  showIndicators?: boolean;
  onScrollPositionChange?: (x: number, y: number) => void;
}

export const InfiniteScrollCanvas: React.FC<InfiniteScrollCanvasProps> = ({
  children,
  scrollMode = 'both',
  showIndicators = true,
  onScrollPositionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [maxScroll, setMaxScroll] = useState({ x: 0, y: 0 });

  const updateScrollPosition = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = containerRef.current;
      const x = scrollLeft;
      const y = scrollTop;
      const maxX = scrollWidth - clientWidth;
      const maxY = scrollHeight - clientHeight;

      setScrollPosition({ x, y });
      setMaxScroll({ x: maxX, y: maxY });
      onScrollPositionChange?.(x, y);
    }
  };

  useEffect(() => {
    updateScrollPosition();
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollPosition);
      window.addEventListener('resize', updateScrollPosition);
      return () => {
        container.removeEventListener('scroll', updateScrollPosition);
        window.removeEventListener('resize', updateScrollPosition);
      };
    }
  }, []);

  const scrollTo = (direction: 'up' | 'down' | 'left' | 'right' | 'center') => {
    if (!containerRef.current) return;

    const { clientWidth, clientHeight, scrollWidth, scrollHeight } = containerRef.current;
    const step = 200;

    switch (direction) {
      case 'up':
        containerRef.current.scrollBy({ top: -step, behavior: 'smooth' });
        break;
      case 'down':
        containerRef.current.scrollBy({ top: step, behavior: 'smooth' });
        break;
      case 'left':
        containerRef.current.scrollBy({ left: -step, behavior: 'smooth' });
        break;
      case 'right':
        containerRef.current.scrollBy({ left: step, behavior: 'smooth' });
        break;
      case 'center':
        containerRef.current.scrollTo({
          left: (scrollWidth - clientWidth) / 2,
          top: (scrollHeight - clientHeight) / 2,
          behavior: 'smooth',
        });
        break;
    }
  };

  const getScrollIndicatorText = () => {
    if (scrollMode === 'vertical') {
      const percent = maxScroll.y > 0 ? Math.round((scrollPosition.y / maxScroll.y) * 100) : 0;
      return `↕ ${percent}%`;
    }
    if (scrollMode === 'horizontal') {
      const percent = maxScroll.x > 0 ? Math.round((scrollPosition.x / maxScroll.x) * 100) : 0;
      return `↔ ${percent}%`;
    }
    if (scrollMode === 'both') {
      const percentX = maxScroll.x > 0 ? Math.round((scrollPosition.x / maxScroll.x) * 100) : 0;
      const percentY = maxScroll.y > 0 ? Math.round((scrollPosition.y / maxScroll.y) * 100) : 0;
      return `⇱ ${percentX}%, ${percentY}%`;
    }
    return 'Bounded';
  };

  const shouldShowVertical = scrollMode === 'vertical' || scrollMode === 'both';
  const shouldShowHorizontal = scrollMode === 'horizontal' || scrollMode === 'both';

  return (
    <div className={styles.wrapper}>
      {/* Scroll Controls */}
      {showIndicators && (
        <div className={styles.controls}>
          <div className={styles.navigationButtons}>
            {shouldShowVertical && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => scrollTo('up')}
                  iconBefore={<ArrowUp size={14} />}
                  title="Scroll Up"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => scrollTo('down')}
                  iconBefore={<ArrowDown size={14} />}
                  title="Scroll Down"
                />
              </>
            )}
            {shouldShowHorizontal && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => scrollTo('left')}
                  iconBefore={<ArrowLeft size={14} />}
                  title="Scroll Left"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => scrollTo('right')}
                  iconBefore={<ArrowRight size={14} />}
                  title="Scroll Right"
                />
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => scrollTo('center')}
              iconBefore={<Maximize size={14} />}
              title="Center View"
            />
          </div>

          <div className={styles.indicator}>
            <span className={styles.indicatorText}>{getScrollIndicatorText()}</span>
          </div>
        </div>
      )}

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        className={`${styles.container} ${styles[scrollMode]}`}
      >
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
};