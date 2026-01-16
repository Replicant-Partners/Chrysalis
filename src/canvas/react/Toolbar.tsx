/**
 * Canvas Toolbar Component
 *
 * Provides controls for:
 * - Adding widgets
 * - Zoom control
 * - Grid toggle
 * - Undo/Redo
 */

import React, { useState, useCallback } from 'react';
import type { WidgetDefinition } from '../widgets/types';
import type { CanvasToolbarProps } from './types';

// =============================================================================
// Styles
// =============================================================================

const toolbarStyles: React.CSSProperties = {
  position: 'absolute',
  top: '16px',
  left: '16px',
  display: 'flex',
  gap: '8px',
  padding: '8px',
  backgroundColor: '#1e1e2e',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  zIndex: 1000,
};

const buttonStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: '#313244',
  color: '#cdd6f4',
  cursor: 'pointer',
  fontSize: '16px',
  transition: 'background-color 0.15s ease',
};

const buttonHoverStyles: React.CSSProperties = {
  backgroundColor: '#45475a',
};

const buttonDisabledStyles: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

const dropdownStyles: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: '8px',
  minWidth: '200px',
  backgroundColor: '#1e1e2e',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  overflow: 'hidden',
  zIndex: 1001,
};

const dropdownItemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 14px',
  color: '#cdd6f4',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
};

const separatorStyles: React.CSSProperties = {
  width: '1px',
  height: '24px',
  backgroundColor: '#45475a',
  margin: '6px 4px',
};

const zoomDisplayStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  fontSize: '13px',
  color: '#a6adc8',
  fontFamily: 'monospace',
};

// =============================================================================
// Toolbar Button
// =============================================================================

interface ToolbarButtonProps {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  title,
  onClick,
  disabled = false,
  active = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      style={{
        ...buttonStyles,
        ...(isHovered && !disabled ? buttonHoverStyles : {}),
        ...(disabled ? buttonDisabledStyles : {}),
        ...(active ? { backgroundColor: '#6366f1' } : {}),
      }}
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {icon}
    </button>
  );
};

// =============================================================================
// Toolbar Component
// =============================================================================

export const Toolbar: React.FC<CanvasToolbarProps> = ({
  availableWidgets,
  onAddWidget,
  zoom,
  onZoomChange,
  gridVisible,
  onGridToggle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Convert zoom (0.1-2.0) to percentage
  const zoomPercent = Math.round(zoom * 100);

  const handleZoomIn = useCallback(() => {
    onZoomChange(Math.min(2, zoom * 1.2));
  }, [zoom, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    onZoomChange(Math.max(0.1, zoom / 1.2));
  }, [zoom, onZoomChange]);

  const handleZoomReset = useCallback(() => {
    onZoomChange(1);
  }, [onZoomChange]);

  const handleAddWidget = useCallback((typeId: string) => {
    onAddWidget(typeId);
    setShowWidgetMenu(false);
  }, [onAddWidget]);

  // Group widgets by category
  const widgetsByCategory = availableWidgets.reduce((acc, widget) => {
    const category = widget.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(widget);
    return acc;
  }, {} as Record<string, WidgetDefinition[]>);

  return (
    <div style={toolbarStyles}>
      {/* Add Widget */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          icon="➕"
          title="Add Widget"
          onClick={() => setShowWidgetMenu(!showWidgetMenu)}
          active={showWidgetMenu}
        />

        {showWidgetMenu && (
          <div style={dropdownStyles}>
            {Object.entries(widgetsByCategory).map(([category, widgets]) => (
              <div key={category}>
                <div style={{
                  padding: '8px 14px 4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#6c7086',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {category}
                </div>
                {widgets.map(widget => (
                  <div
                    key={widget.typeId}
                    style={{
                      ...dropdownItemStyles,
                      backgroundColor: hoveredItem === widget.typeId ? '#313244' : 'transparent',
                    }}
                    onClick={() => handleAddWidget(widget.typeId)}
                    onMouseEnter={() => setHoveredItem(widget.typeId)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <span>{widget.icon || '📦'}</span>
                    <span>{widget.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={separatorStyles} />

      {/* Undo/Redo */}
      <ToolbarButton
        icon="↩️"
        title="Undo (⌘Z)"
        onClick={onUndo}
        disabled={!canUndo}
      />
      <ToolbarButton
        icon="↪️"
        title="Redo (⌘⇧Z)"
        onClick={onRedo}
        disabled={!canRedo}
      />

      <div style={separatorStyles} />

      {/* Zoom Controls */}
      <ToolbarButton
        icon="➖"
        title="Zoom Out"
        onClick={handleZoomOut}
        disabled={zoom <= 0.1}
      />
      <div
        style={zoomDisplayStyles}
        onClick={handleZoomReset}
        title="Reset Zoom"
      >
        {zoomPercent}%
      </div>
      <ToolbarButton
        icon="➕"
        title="Zoom In"
        onClick={handleZoomIn}
        disabled={zoom >= 2}
      />

      <div style={separatorStyles} />

      {/* Grid Toggle */}
      <ToolbarButton
        icon="⊞"
        title={gridVisible ? 'Hide Grid' : 'Show Grid'}
        onClick={onGridToggle}
        active={gridVisible}
      />
    </div>
  );
};

export default Toolbar;
