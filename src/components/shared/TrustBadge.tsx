import React from 'react';
import { tokens, ThemeMode } from './tokens';

export type TrustLevel = 'external' | 'internal' | 'ada';

export interface TrustBadgeProps {
  level: TrustLevel;
  mode?: ThemeMode;
  label?: string;
}

const styles = {
  base: (mode: ThemeMode, tint: string, lineStyle: React.CSSProperties['borderStyle']) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    lineHeight: 1,
    color: tokens.color.text.secondary[mode],
    border: `1px ${lineStyle} ${tint}`,
    background: 'transparent',
  }),
};

const lineStyleMap: Record<TrustLevel, React.CSSProperties['borderStyle']> = {
  external: 'dashed',
  internal: 'solid',
  ada: 'double',
};

const tintMap = (mode: ThemeMode) => ({
  external: tokens.color.trust.external[mode],
  internal: tokens.color.trust.internal[mode],
  ada: tokens.color.trust.ada[mode],
});

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  level,
  mode = 'dark',
  label,
}) => {
  const tint = tintMap(mode)[level];
  const lineStyle = lineStyleMap[level];
  return (
    <span style={styles.base(mode, tint, lineStyle)}>
      {label ?? level}
    </span>
  );
};

export default TrustBadge;