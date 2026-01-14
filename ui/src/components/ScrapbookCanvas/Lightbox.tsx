/**
 * Lightbox Component
 * 
 * Full-screen media viewer for images and videos
 */

import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ScrapbookItem } from './types';
import styles from './Lightbox.module.css';

interface LightboxProps {
  item: ScrapbookItem;
  items: ScrapbookItem[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  item,
  items,
  onClose,
  onNavigate,
}) => {
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        onNavigate('next');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate]);
  
  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  const currentIndex = items.findIndex(i => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;
  
  return (
    <div className={styles.lightbox} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className={styles.closeButton} onClick={onClose} title="Close (Esc)">
          <X size={24} />
        </button>
        
        {/* Navigation */}
        {hasPrev && (
          <button
            className={`${styles.navButton} ${styles.navPrev}`}
            onClick={() => onNavigate('prev')}
            title="Previous (←)"
          >
            <ChevronLeft size={32} />
          </button>
        )}
        
        {hasNext && (
          <button
            className={`${styles.navButton} ${styles.navNext}`}
            onClick={() => onNavigate('next')}
            title="Next (→)"
          >
            <ChevronRight size={32} />
          </button>
        )}
        
        {/* Media Content */}
        <div className={styles.mediaContainer}>
          {item.type === 'image' && item.url && (
            <img src={item.url} alt={item.title} className={styles.media} />
          )}
          
          {item.type === 'video' && item.url && (
            <video src={item.url} controls className={styles.media} />
          )}
        </div>
        
        {/* Item Info */}
        <div className={styles.info}>
          <h3 className={styles.title}>{item.title}</h3>
          <div className={styles.meta}>
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
            {item.metadata.size && (
              <span>
                {(item.metadata.size / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
            {item.metadata.dimensions && (
              <span>
                {item.metadata.dimensions.width} × {item.metadata.dimensions.height}
              </span>
            )}
          </div>
          {item.tags.length > 0 && (
            <div className={styles.tags}>
              {item.tags.map(tag => (
                <span key={tag} className={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};