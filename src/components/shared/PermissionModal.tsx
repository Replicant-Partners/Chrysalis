import React from 'react';
import { tokens, ThemeMode } from './tokens';
import { TrustBadge, TrustLevel } from './TrustBadge';

export interface PermissionModalProps {
  open: boolean;
  requestId: string;
  agentName: string;
  trust: TrustLevel;
  summary: string;
  scopePreview?: string;
  mode?: ThemeMode;
  onApprove?: (requestId: string) => void;
  onDeny?: (requestId: string) => void;
  onExplainRisk?: (requestId: string) => void;
  onClose?: () => void;
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: (mode: ThemeMode) => ({
    width: 420,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface.base[mode],
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    padding: tokens.spacing.lg,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing.md,
  }),
  title: (mode: ThemeMode) => ({
    fontSize: tokens.typography.title,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary[mode],
  }),
  text: (mode: ThemeMode) => ({
    color: tokens.color.text.secondary[mode],
  }),
  actions: {
    display: 'flex',
    gap: 8,
  },
  button: (mode: ThemeMode) => ({
    padding: '6px 12px',
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    background: 'transparent',
    color: tokens.color.text.primary[mode],
    cursor: 'pointer',
  }),
};

export const PermissionModal: React.FC<PermissionModalProps> = ({
  open,
  requestId,
  agentName,
  trust,
  summary,
  scopePreview,
  mode = 'dark',
  onApprove,
  onDeny,
  onExplainRisk,
  onClose,
}) => {
  if (!open) return null;
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal(mode)} onClick={(e) => e.stopPropagation()}>
        <TrustBadge level={trust} mode={mode} />
        <div style={styles.title(mode)}>{agentName} requires approval</div>
        <div style={styles.text(mode)}>{summary}</div>
        {scopePreview && <div style={styles.text(mode)}>{scopePreview}</div>}
        <div style={styles.actions}>
          <button style={styles.button(mode)} onClick={() => onApprove?.(requestId)}>Approve</button>
          <button style={styles.button(mode)} onClick={() => onDeny?.(requestId)}>Deny</button>
          <button style={styles.button(mode)} onClick={() => onExplainRisk?.(requestId)}>Why?</button>
        </div>
      </div>
    </div>
  );
};

export default PermissionModal;