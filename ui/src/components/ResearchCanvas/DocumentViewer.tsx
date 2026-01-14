/**
 * DocumentViewer Component
 * 
 * Renders markdown with syntax highlighting and wiki-link support
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './DocumentViewer.module.css';

interface DocumentViewerProps {
  content: string;
  onWikiLinkClick?: (link: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  content,
  onWikiLinkClick,
}) => {
  // Process wiki-links [[Page Name]]
  const processedContent = content.replace(
    /\[\[([^\]]+)\]\]/g,
    (_match, linkText) => `[${linkText}](#wiki:${linkText})`
  );
  
  return (
    <div className={styles.viewer}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }: any) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ href, children, ...props }: any) {
            if (href?.startsWith('#wiki:')) {
              const wikiLink = href.replace('#wiki:', '');
              return (
                <a
                  href="#"
                  className={styles.wikiLink}
                  onClick={(e) => {
                    e.preventDefault();
                    onWikiLinkClick?.(wikiLink);
                  }}
                  {...props}
                >
                  {children}
                </a>
              );
            }
            return <a href={href} {...props}>{children}</a>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};