/**
 * ScrapbookItem Component
 * 
 * Individual item card in the scrapbook grid
 */

import React from 'react';
import { Image, Video, Music, Link as LinkIcon, FileText, X, Tag as TagIcon } from 'lucide-react';
import { Badge } from '../design-system';
import type { ScrapbookItem as ScrapbookItemType, ScrapbookItemType as ItemType } from './types';
import styles from './ScrapbookItem.module.css';

interface ScrapbookItemProps {
  item: ScrapbookItemType;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTagRemove: (itemId: string, tag: string) => void;
  onOpenLightbox: (id: string) => void;
}

const getItemIcon = (type: ItemType) => {
  switch (type) {
    case 'image':
      return <Image size={16} />;
    case 'video':
      return <Video size={16} />;
    case 'audio':
      return <Music size={16} />;
    case 'link':
      return <LinkIcon size={16} />;
    case 'note':
      return <FileText size={16} />;
    default:
      return <FileText size={16} />;
  }
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ScrapbookItem: React.FC<ScrapbookItemProps> = ({
  item,
  onSelect,
  onDelete,
  onTagRemove,
  onOpenLightbox,
}) => {
  const handleClick = () => {
    if (item.type === 'image' || item.type === 'video') {
      onOpenLightbox(item.id);
    } else {
      onSelect(item.id);
    }
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  };
  
  return (
    <div className={styles.item} onClick={handleClick}>
      {/* Thumbnail/Preview */}
      <div className={styles.preview}>
        {item.type === 'image' && item.url && (
          <img src={item.thumbnail || item.url} alt={item.title} className={styles.image} />
        )}
        {item.type === 'video' && item.thumbnail && (
          <div className={styles.videoPreview}>
            <img src={item.thumbnail} alt={item.title} className={styles.image} />
            <div className={styles.playOverlay}>
              <Video size={32} />
            </div>
          </div>
        )}
        {item.type === 'audio' && (
          <div className={styles.audioPreview}>
            <Music size={48} />
          </div>
        )}
        {item.type === 'link' && (
          <div className={styles.linkPreview}>
            <LinkIcon size={48} />
          </div>
        )}
        {item.type === 'note' && (
          <div className={styles.notePreview}>
            <FileText size={48} />
            {item.content && (
              <p className={styles.noteText}>{item.content.substring(0, 100)}</p>
            )}
          </div>
        )}
        
        {/* Type Badge */}
        <div className={styles.typeBadge}>
          {getItemIcon(item.type)}
        </div>
        
        {/* Delete Button */}
        <button className={styles.deleteButton} onClick={handleDelete} title="Delete">
          <X size={16} />
        </button>
      </div>
      
      {/* Item Details */}
      <div className={styles.details}>
        <h4 className={styles.title}>{item.title}</h4>
        
        {/* Metadata */}
        <div className={styles.metadata}>
          {item.metadata.size && (
            <span className={styles.metaItem}>{formatFileSize(item.metadata.size)}</span>
          )}
          {item.metadata.duration && (
            <span className={styles.metaItem}>{formatDuration(item.metadata.duration)}</span>
          )}
          {item.metadata.dimensions && (
            <span className={styles.metaItem}>
              {item.metadata.dimensions.width} × {item.metadata.dimensions.height}
            </span>
          )}
        </div>
        
        {/* Tags */}
        {item.tags.length > 0 && (
          <div className={styles.tags}>
            {item.tags.map((tag) => (
              <Badge
                key={tag}
                variant="default"
                className={styles.tag}
              >
                <TagIcon size={10} />
                {tag}
                <button
                  className={styles.tagRemove}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagRemove(item.id, tag);
                  }}
                  title="Remove tag"
                >
                  <X size={10} />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};