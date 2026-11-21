import React from 'react';
import * as L from 'lucide-react';

// Icon vector theo tên Lucide (vd "shield-check", "ShieldCheck", "phone"). Không tìm thấy → coi là emoji/chữ.
const toPascal = (s: string) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
export const Icon: React.FC<{ name?: string; size: number; color: string; stroke?: number }> = ({ name, size, color, stroke = 2 }) => {
  if (!name) return null;
  const C = (L as any)[toPascal(name)] ?? (L as any)[name];
  if (C && typeof C === 'object') return <C size={size} color={color} strokeWidth={stroke} />;
  return <span style={{ fontSize: size * 0.9, lineHeight: 1, display: 'inline-block' }}>{name}</span>;
};
