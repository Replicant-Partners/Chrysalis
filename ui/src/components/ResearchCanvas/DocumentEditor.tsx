/**
 * DocumentEditor Component
 * 
 * Markdown editor with toolbar
 */

import React, { useCallback } from 'react';
import { Bold, Italic, Code, List, ListOrdered, Link as LinkIcon, Image } from 'lucide-react';
import styles from './DocumentEditor.module.css';

interface DocumentEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start writing...',
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  const insertMarkdown = useCallback((before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    const newText = 
      content.substring(0, start) +
      before +
      selectedText +
      after +
      content.substring(end);
    
    onChange(newText);
    
    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  }, [content, onChange]);
  
  const handleBold = () => insertMarkdown('**', '**');
  const handleItalic = () => insertMarkdown('*', '*');
  const handleCode = () => insertMarkdown('`', '`');
  const handleLink = () => insertMarkdown('[', '](url)');
  const handleImage = () => insertMarkdown('![alt](', ')');
  const handleList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    
    const newText = 
      content.substring(0, lineStart) +
      '- ' +
      content.substring(lineStart);
    
    onChange(newText);
  };
  
  const handleOrderedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    
    const newText = 
      content.substring(0, lineStart) +
      '1. ' +
      content.substring(lineStart);
    
    onChange(newText);
  };
  
  return (
    <div className={styles.editor}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button
          className={styles.toolButton}
          onClick={handleBold}
          title="Bold (Ctrl+B)"
        >
          <Bold size={18} />
        </button>
        <button
          className={styles.toolButton}
          onClick={handleItalic}
          title="Italic (Ctrl+I)"
        >
          <Italic size={18} />
        </button>
        <button
          className={styles.toolButton}
          onClick={handleCode}
          title="Code"
        >
          <Code size={18} />
        </button>
        
        <div className={styles.separator} />
        
        <button
          className={styles.toolButton}
          onClick={handleList}
          title="Bullet List"
        >
          <List size={18} />
        </button>
        <button
          className={styles.toolButton}
          onClick={handleOrderedList}
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </button>
        
        <div className={styles.separator} />
        
        <button
          className={styles.toolButton}
          onClick={handleLink}
          title="Link"
        >
          <LinkIcon size={18} />
        </button>
        <button
          className={styles.toolButton}
          onClick={handleImage}
          title="Image"
        >
          <Image size={18} />
        </button>
      </div>
      
      {/* Text Area */}
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};