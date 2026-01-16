import React from 'react';
import { tokens, ThemeMode } from './tokens';
import { TrustBadge, TrustLevel } from './TrustBadge';

export interface PermissionCardProps {
  requestId: string;
  agentName: string;
  trust: TrustLevel;
  summary: string;
  scopePreview?: string;
  mode?: ThemeMode;
  riskLevel?: 'low' | 'med' | 'high';
  onApprove?: (requestId: string) => void;
  onDeny?: (requestId: string) => void;
  onExplainRisk?: (requestId: string) => void;
}

const styles = {
  card: (mode: ThemeMode) => ({
    border: `1px solid ${tokens.color.border.subtle[mode]}`,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    backgroundColor: tokens.color.surface.base[mode],
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing.sm,
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: (mode: ThemeMode) => ({
    fontSize: tokens.typography.title,
    color: tokens.color.text.primary[mode],
    fontWeight: tokens.typography.weight.bold,
  }),
  text: (mode: ThemeMode) => ({
    fontSize: tokens.typography.body,
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
  subtle: (mode: ThemeMode) => ({
    color: tokens.color.text.secondary[mode],
    borderColor: tokens.color.border.subtle[mode],
  }),
};

export const PermissionCard: React.FC<PermissionCardProps> = ({
  requestId,
  agentName,
  trust,
  summary,
  scopePreview,
  mode = 'dark',
  onApprove,
  onDeny,
  onExplainRisk,
}) => (
  <div style={styles.card(mode)}>
    <div style={styles.header}>
      <TrustBadge level={trust} mode={mode} />
      <div style={styles.title(mode)}>{agentName} requests access</div>
    </div>
    <div style={styles.text(mode)}>{summary}</div>
    {scopePreview && <div style={styles.text(mode)}>{scopePreview}</div>}
    <div style={styles.actions}>
      <button style={styles.button(mode)} onClick={() => onApprove?.(requestId)}>Approve</button>
      <button style={{ ...styles.button(mode), ...styles.subtle(mode) }} onClick={() => onDeny?.(requestId)}>Deny</button>
      <button style={{ ...styles.button(mode), ...styles.subtle(mode) }} onClick={() => onExplainRisk?.(requestId)}>Why?</button>
    </div>
  </div>
);

export default PermissionCard;