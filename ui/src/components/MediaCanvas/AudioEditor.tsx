/**
 * Audio Editor Component
 * 
 * Audio editing workspace with playback and basic controls
 * Note: Full waveform visualization with wavesurfer.js would be added in production
 */

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { useMediaStore } from './store';
import { formatDuration } from './utils';
import styles from './AudioEditor.module.css';

export const AudioEditor: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const {
    items,
    selectedItemId,
    audioEdits,
    setAudioEdit,
    resetAudioEdits,
  } = useMediaStore();
  
  const selectedItem = items.find((i) => i.id === selectedItemId);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioEdits.volume / 100;
    }
  }, [audioEdits.volume]);
  
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  if (!selectedItem || selectedItem.type !== 'audio') {
    return (
      <div className={styles.empty}>
        <p>Select an audio file to edit</p>
      </div>
    );
  }
  
  return (
    <div className={styles.editor}>
      <audio ref={audioRef} src={selectedItem.url} />
      
      <div className={styles.waveform}>
        <div className={styles.waveformPlaceholder}>
          <p>Waveform visualization</p>
          <p className={styles.hint}>(wavesurfer.js integration planned)</p>
        </div>
      </div>
      
      <div className={styles.controls}>
        <button className={styles.playButton} onClick={togglePlayPause}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
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
      
      <div className={styles.editControls}>
        <div className={styles.controlGroup}>
          <label className={styles.label}>
            <Volume2 size={18} />
            Volume: {audioEdits.volume}%
          </label>
          <input
            type="range"
            min="0"
            max="200"
            value={audioEdits.volume}
            onChange={(e) => setAudioEdit({ volume: Number(e.target.value) })}
            className={styles.slider}
          />
        </div>
        
        <div className={styles.controlGroup}>
          <label className={styles.label}>Fade In (seconds)</label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={audioEdits.fadeIn || 0}
            onChange={(e) => setAudioEdit({ fadeIn: Number(e.target.value) })}
            className={styles.numberInput}
          />
        </div>
        
        <div className={styles.controlGroup}>
          <label className={styles.label}>Fade Out (seconds)</label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={audioEdits.fadeOut || 0}
            onChange={(e) => setAudioEdit({ fadeOut: Number(e.target.value) })}
            className={styles.numberInput}
          />
        </div>
        
        <button className={styles.resetButton} onClick={() => resetAudioEdits()}>
          Reset
        </button>
      </div>
    </div>
  );
};