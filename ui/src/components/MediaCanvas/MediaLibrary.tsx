/**
 * Media Library Component
 * 
 * Displays uploaded media files with upload functionality
 */

import React, { useCallback, useRef } from 'react';
import { Upload, Image, Music, Video, Trash2 } from 'lucide-react';
import { useMediaStore } from './store';
import { formatFileSize, getMediaTypeFromMime, isValidMediaFile, createThumbnail } from './utils';
import type { MediaType } from './enums';
import styles from './MediaLibrary.module.css';

export const MediaLibrary: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    items,
    selectedItemId,
    filterType,
    addItem,
    deleteItem,
    selectItem,
    setFilterType,
  } = useMediaStore();
  
  // Filter items by type
  const filteredItems = filterType === 'all'
    ? items
    : items.filter((item) => item.type === filterType);
  
  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isValidMediaFile(file)) continue;
      
      const url = URL.createObjectURL(file);
      const type = getMediaTypeFromMime(file.type);
      if (!type) continue;
      
      // Create thumbnail for images
      let thumbnail: string | undefined;
      if (type === 'image') {
        try {
          thumbnail = await createThumbnail(file);
        } catch (error) {
          console.error('Failed to create thumbnail:', error);
        }
      }
      
      // Get dimensions for images/videos
      let dimensions: { width: number; height: number } | undefined;
      if (type === 'image') {
        const img = new window.Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = () => {
            dimensions = { width: img.width, height: img.height };
            resolve(null);
          };
        });
      }
      
      // Get duration for audio/video
      let duration: number | undefined;
      if (type === 'audio' || type === 'video') {
        const media = document.createElement(type) as HTMLMediaElement;
        media.src = url;
        await new Promise((resolve) => {
          media.onloadedmetadata = () => {
            duration = media.duration;
            resolve(null);
          };
        });
      }
      
      addItem({
        type,
        filename: file.name,
        url,
        thumbnail,
        size: file.size,
        duration,
        dimensions,
        mimeType: file.type,
      });
    }
  }, [addItem]);
  
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);
  
  const getTypeIcon = (type: MediaType) => {
    switch (type) {
      case 'image':
        return <Image className={styles.typeIcon} />;
      case 'audio':
        return <Music className={styles.typeIcon} />;
      case 'video':
        return <Video className={styles.typeIcon} />;
    }
  };
  
  return (
    <div className={styles.library}>
      <div className={styles.header}>
        <h3 className={styles.title}>Media Library</h3>
        <button
          className={styles.uploadButton}
          onClick={handleUploadClick}
          title="Upload media"
        >
          <Upload size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className={styles.fileInput}
          accept="image/*,audio/*,video/*"
          multiple
          onChange={handleFileInputChange}
        />
      </div>
      
      <div className={styles.filters}>
        <button
          className={`${styles.filterChip} ${filterType === 'all' ? styles.active : ''}`}
          onClick={() => setFilterType('all')}
        >
          All Files
        </button>
        <button
          className={`${styles.filterChip} ${filterType === 'image' ? styles.active : ''}`}
          onClick={() => setFilterType('image')}
        >
          Images
        </button>
        <button
          className={`${styles.filterChip} ${filterType === 'audio' ? styles.active : ''}`}
          onClick={() => setFilterType('audio')}
        >
          Audio
        </button>
        <button
          className={`${styles.filterChip} ${filterType === 'video' ? styles.active : ''}`}
          onClick={() => setFilterType('video')}
        >
          Video
        </button>
      </div>
      
      <div className={styles.list}>
        {filteredItems.length === 0 && (
          <div className={styles.empty}>
            <Upload className={styles.emptyIcon} />
            <p className={styles.emptyText}>No files uploaded</p>
            <p className={styles.emptyHint}>
              Drag files here or click upload button
            </p>
          </div>
        )}
        
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`${styles.item} ${item.id === selectedItemId ? styles.selected : ''}`}
            onClick={() => selectItem(item.id)}
          >
            <div className={styles.itemThumbnail}>
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.filename} />
              ) : (
                getTypeIcon(item.type)
              )}
            </div>
            <div className={styles.itemInfo}>
              <div className={styles.itemName}>{item.filename}</div>
              <div className={styles.itemMeta}>
                {formatFileSize(item.size)}
                {item.duration && ` • ${Math.floor(item.duration)}s`}
              </div>
            </div>
            <button
              className={styles.deleteButton}
              onClick={(e) => {
                e.stopPropagation();
                deleteItem(item.id);
              }}
              title="Delete file"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};