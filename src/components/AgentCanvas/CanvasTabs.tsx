import React from 'react';
import { tokens, ThemeMode, useTheme } from '../shared';

export interface CanvasTab {
  id: string;
  label: string;
  isReady?: boolean;
}

export interface CanvasTabsProps {
  tabs: CanvasTab[];
  activeTabId: string;
  mode?: ThemeMode;
  onSelectTab?: (tabId: string) => void;
  onOpenCanvas?: () => void;
}

const styles = {
  container: (mode: ThemeMode) => ({
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
    borderBottom: `1px solid ${tokens.color.border.subtle[mode]}`,
    backgroundColor: tokens.color.surface.base[mode],
  }),
  tab: (mode: ThemeMode, active: boolean) => ({
    padding: '6px 10px',
    borderRadius: tokens.radius.md,
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    backgroundColor: active ? tokens.color.surface.primaryPane[mode] : 'transparent',
    color: tokens.color.text.primary[mode],
    fontSize: tokens.typography.label,
    cursor: 'pointer',
    transition: `all ${tokens.motion.snap} ${tokens.motion.easeSnap}`,
  }),
  tabInactive: (mode: ThemeMode) => ({
    color: tokens.color.text.secondary[mode],
  }),
  readyDot: (mode: ThemeMode) => ({
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: tokens.color.text.secondary[mode],
    display: 'inline-block',
    marginLeft: 6,
  }),
  addButton: (mode: ThemeMode) => ({
    marginLeft: 'auto',
    width: 28,
    height: 28,
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    background: 'transparent',
    color: tokens.color.text.secondary[mode],
    cursor: 'pointer',
  }),
};

export const CanvasTabs: React.FC<CanvasTabsProps> = ({
  tabs,
  activeTabId,
  mode: modeProp,
  onSelectTab,
  onOpenCanvas,
}) => {
  const { mode: themeMode } = useTheme();
  const mode = modeProp ?? themeMode;
  
  return (
  <div style={styles.container(mode)}>
    {tabs.map((tab) => {
      const active = tab.id === activeTabId;
      return (
        <button
          key={tab.id}
          style={{
            ...styles.tab(mode, active),
            ...(active ? {} : styles.tabInactive(mode)),
          }}
          onClick={() => onSelectTab?.(tab.id)}
        >
          {tab.label}
          {tab.isReady && <span style={styles.readyDot(mode)} />}
        </button>
      );
    })}
    <button
      style={styles.addButton(mode)}
      onClick={onOpenCanvas}
      title="Open new canvas"
      aria-label="Open new canvas"
    >
      +
    </button>
  </div>
  );
};

export default CanvasTabs;