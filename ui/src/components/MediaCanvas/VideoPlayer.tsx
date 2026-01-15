/**
 * Video Player Component
 * 
 * Video preview with basic playback controls
 */

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { useMediaStore } from './store';
import { formatDuration } from './utils';
import styles from './VideoPlayer.module.css';

export const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const {
    items,
    selectedItemId,
  } = useMediaStore();
  
  const selectedItem = items.find((i) => i.id === selectedItemId);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  if (!selectedItem || selectedItem.type !== 'video') {
    return (
      <div className={styles.empty}>
        <p>Select a video file to preview</p>
      </div>
    );
  }
  
  return (
    <div className={styles.player}>
      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          src={selectedItem.url}
          className={styles.video}
          onClick={togglePlayPause}
        />
        <button className={styles.playOverlay} onClick={togglePlayPause}>
          {isPlaying ? <Pause size={48} /> : <Play size={48} />}
        </button>
      </div>
      
      <div className={styles.controls}>
        <button className={styles.playButton} onClick={togglePlayPause}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        
        <div className={styles.timeDisplay}>
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </div>
        
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className={styles.seekBar}
        />
      </div>
      
      <div className={styles.metadata}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Duration:</span>
          <span className={styles.metaValue}>{formatDuration(selectedItem.duration || 0)}</span>
        </div>
        {selectedItem.dimensions && (
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Resolution:</span>
            <span className={styles.metaValue}>
              {selectedItem.dimensions.width} × {selectedItem.dimensions.height}
            </span>
          </div>
        )}
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Format:</span>
          <span className={styles.metaValue}>{selectedItem.mimeType}</span>
        </div>
      </div>
      
      <div className={styles.trimControls}>
        <p className={styles.trimHint}>Basic trim controls (trim editing planned for future release)</p>
      </div>
    </div>
  );
};