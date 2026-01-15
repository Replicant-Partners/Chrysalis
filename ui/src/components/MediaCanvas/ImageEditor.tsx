/**
 * Image Editor Component
 * 
 * Image editing workspace with crop, rotate, flip, and filters
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Crop, 
  RotateCw, 
  RotateCcw, 
  FlipHorizontal, 
  FlipVertical,
  RefreshCcw
} from 'lucide-react';
import { useMediaStore } from './store';
import { loadImage } from './utils';
import styles from './ImageEditor.module.css';

export const ImageEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cropMode, setCropMode] = useState(false);
  
  const {
    items,
    selectedItemId,
    imageEdits,
    setImageEdit,
    resetImageEdits,
    applyImageEdit,
  } = useMediaStore();
  
  const selectedItem = items.find((i) => i.id === selectedItemId);
  
  // Render image to canvas with edits applied
  const renderImage = useCallback(async () => {
    if (!selectedItem || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
      const img = await loadImage(selectedItem.url);
      
      // Set canvas size
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Save context
      ctx.save();
      
      // Apply transformations
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((imageEdits.rotation * Math.PI) / 180);
      ctx.scale(
        imageEdits.flipH ? -1 : 1,
        imageEdits.flipV ? -1 : 1
      );
      
      // Draw image
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      // Restore context
      ctx.restore();
      
      // Apply filters
      if (imageEdits.brightness !== 0 || imageEdits.contrast !== 0 || imageEdits.saturation !== 0 || imageEdits.filter !== 'none') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply brightness/contrast/saturation
        for (let i = 0; i < data.length; i += 4) {
          // Brightness
          if (imageEdits.brightness !== 0) {
            data[i] += imageEdits.brightness * 2.55;
            data[i + 1] += imageEdits.brightness * 2.55;
            data[i + 2] += imageEdits.brightness * 2.55;
          }
          
          // Contrast
          if (imageEdits.contrast !== 0) {
            const factor = (259 * (imageEdits.contrast + 255)) / (255 * (259 - imageEdits.contrast));
            data[i] = factor * (data[i] - 128) + 128;
            data[i + 1] = factor * (data[i + 1] - 128) + 128;
            data[i + 2] = factor * (data[i + 2] - 128) + 128;
          }
          
          // Saturation (simplified)
          if (imageEdits.saturation !== 0) {
            const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
            const factor = (imageEdits.saturation + 100) / 100;
            data[i] = gray + factor * (data[i] - gray);
            data[i + 1] = gray + factor * (data[i + 1] - gray);
            data[i + 2] = gray + factor * (data[i + 2] - gray);
          }
        }
        
        // Apply filter
        if (imageEdits.filter === 'grayscale') {
          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
        } else if (imageEdits.filter === 'sepia') {
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            data[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
            data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
            data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
          }
        } else if (imageEdits.filter === 'blur') {
          // Simple box blur (for demo - would use better algorithm in production)
          ctx.filter = 'blur(2px)';
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = 'none';
          return;
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (error) {
      console.error('Failed to render image:', error);
    }
  }, [selectedItem, imageEdits]);
  
  useEffect(() => {
    renderImage();
  }, [renderImage]);
  
  if (!selectedItem || selectedItem.type !== 'image') {
    return (
      <div className={styles.empty}>
        <p>Select an image to edit</p>
      </div>
    );
  }
  
  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            className={`${styles.toolButton} ${cropMode ? styles.active : ''}`}
            onClick={() => setCropMode(!cropMode)}
            title="Crop"
          >
            <Crop size={18} />
          </button>
          <button
            className={styles.toolButton}
            onClick={() => {
              setImageEdit({ rotation: (imageEdits.rotation + 90) % 360 });
              applyImageEdit('rotate-cw');
            }}
            title="Rotate clockwise"
          >
            <RotateCw size={18} />
          </button>
          <button
            className={styles.toolButton}
            onClick={() => {
              setImageEdit({ rotation: (imageEdits.rotation - 90 + 360) % 360 });
              applyImageEdit('rotate-ccw');
            }}
            title="Rotate counter-clockwise"
          >
            <RotateCcw size={18} />
          </button>
          <button
            className={styles.toolButton}
            onClick={() => {
              setImageEdit({ flipH: !imageEdits.flipH });
              applyImageEdit('flip-h');
            }}
            title="Flip horizontal"
          >
            <FlipHorizontal size={18} />
          </button>
          <button
            className={styles.toolButton}
            onClick={() => {
              setImageEdit({ flipV: !imageEdits.flipV });
              applyImageEdit('flip-v');
            }}
            title="Flip vertical"
          >
            <FlipVertical size={18} />
          </button>
        </div>
        
        <div className={styles.toolGroup}>
          <button
            className={styles.toolButton}
            onClick={() => resetImageEdits()}
            title="Reset all edits"
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </div>
      
      <div className={styles.canvas}>
        <canvas ref={canvasRef} className={styles.image} />
      </div>
      
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Filters</label>
          <div className={styles.buttonGroup}>
            <button
              className={`${styles.filterButton} ${imageEdits.filter === 'none' ? styles.active : ''}`}
              onClick={() => setImageEdit({ filter: 'none' })}
            >
              Original
            </button>
            <button
              className={`${styles.filterButton} ${imageEdits.filter === 'grayscale' ? styles.active : ''}`}
              onClick={() => setImageEdit({ filter: 'grayscale' })}
            >
              Grayscale
            </button>
            <button
              className={`${styles.filterButton} ${imageEdits.filter === 'sepia' ? styles.active : ''}`}
              onClick={() => setImageEdit({ filter: 'sepia' })}
            >
              Sepia
            </button>
            <button
              className={`${styles.filterButton} ${imageEdits.filter === 'blur' ? styles.active : ''}`}
              onClick={() => setImageEdit({ filter: 'blur' })}
            >
              Blur
            </button>
          </div>
        </div>
        
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>
            Brightness: {imageEdits.brightness}
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={imageEdits.brightness}
            onChange={(e) => setImageEdit({ brightness: Number(e.target.value) })}
            className={styles.slider}
          />
        </div>
        
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>
            Contrast: {imageEdits.contrast}
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={imageEdits.contrast}
            onChange={(e) => setImageEdit({ contrast: Number(e.target.value) })}
            className={styles.slider}
          />
        </div>
        
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>
            Saturation: {imageEdits.saturation}
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={imageEdits.saturation}
            onChange={(e) => setImageEdit({ saturation: Number(e.target.value) })}
            className={styles.slider}
          />
        </div>
      </div>
    </div>
  );
};