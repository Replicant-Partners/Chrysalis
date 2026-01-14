/**
 * FileUpload Component
 * 
 * Drag-and-drop file upload zone for Scrapbook Canvas
 */

import React, { useCallback, useState } from 'react';
import { Upload, Image, Video, Music, FileText } from 'lucide-react';
import { Button } from '../design-system';
import styles from './FileUpload.module.css';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  accept = 'image/*,video/*,audio/*',
  maxFiles = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).slice(0, maxFiles);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected, maxFiles]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files).slice(0, maxFiles) : [];
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFilesSelected, maxFiles]);
  
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  return (
    <div
      className={`${styles.uploadZone} ${isDragging ? styles.dragging : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <div className={styles.uploadContent}>
        <div className={styles.uploadIcon}>
          <Upload size={48} />
        </div>
        
        <h3 className={styles.uploadTitle}>
          Drop files here or click to browse
        </h3>
        
        <p className={styles.uploadDescription}>
          Supports images, videos, audio files, and links
        </p>
        
        <div className={styles.uploadTypes}>
          <div className={styles.typeIcon}>
            <Image size={20} />
            <span>Images</span>
          </div>
          <div className={styles.typeIcon}>
            <Video size={20} />
            <span>Videos</span>
          </div>
          <div className={styles.typeIcon}>
            <Music size={20} />
            <span>Audio</span>
          </div>
          <div className={styles.typeIcon}>
            <FileText size={20} />
            <span>Notes</span>
          </div>
        </div>
        
        <Button variant="primary" size="md">
          Browse Files
        </Button>
      </div>
    </div>
  );
};