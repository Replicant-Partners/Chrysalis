/**
 * Media Canvas - Enums and Type Aliases
 * 
 * Type definitions for media types, editing modes, and export options
 */

export type MediaType = 'image' | 'audio' | 'video';

export type EditorMode = 'image' | 'audio' | 'video' | 'none';

export type ImageFilter = 'grayscale' | 'sepia' | 'blur' | 'none';

export type ExportQuality = 'low' | 'medium' | 'high' | 'original';

export type ExportFormat = 
  | 'image/jpeg' 
  | 'image/png' 
  | 'image/webp'
  | 'audio/mp3' 
  | 'audio/wav' 
  | 'audio/ogg'
  | 'video/mp4' 
  | 'video/webm';

export type EditAction = 
  | 'crop' 
  | 'rotate-cw' 
  | 'rotate-ccw' 
  | 'flip-h' 
  | 'flip-v' 
  | 'filter' 
  | 'trim' 
  | 'fade-in' 
  | 'fade-out' 
  | 'volume';