import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EXPR_LIST, POSE_LIST, Person } from './kit/Character';
import type { CharacterSpec } from './types';
import { useFonts } from './kit/fonts';

// Bảng nhân vật: mỗi nhân vật 2 hàng — các tư thế và các biểu cảm (dùng để duyệt hình nhân vật).
const DEFAULT: CharacterSpec[] = [
  { id: 'minh', name: 'Minh', kind: 'misa', gender: 'nam', hair: 'ngan' },
  { id: 'lan', name: 'Lan', kind: 'misa', gender: 'nu', hair: 'dai' },
];
export const SHEET = { rowH: 760, labelW: 190, cell: 170 };

export const CharacterSheet: React.FC<{ characters?: CharacterSpec[]; mouth?: number }> = ({ characters = DEFAULT, mouth = 0 }) => {
  useFonts();
  const f = useCurrentFrame();
  const cell = (key: string, label: string, el: React.ReactNode) => (
    <div key={key} style={{ width: SHEET.cell, height: 360, overflow: 'hidden', textAlign: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', left: SHEET.cell / 2 - 85, top: 0 }}>{el}</div>
      <div style={{ position: 'absolute', bottom: 0, width: '100%', fontSize: 17, color: '#333', background: 'rgba(243,241,234,.92)', padding: '2px 0' }}>{label}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#F3F1EA', fontFamily: 'Google Sans, sans-serif', padding: 30 }}>
      {characters.map((c) => (
        <div key={c.id} style={{ display: 'flex', gap: 12, marginBottom: 20, height: SHEET.rowH - 20 }}>
          <div style={{ width: SHEET.labelW, fontSize: 32, fontWeight: 700, color: '#222' }}>
            {c.name}
            <div style={{ fontSize: 17, fontWeight: 400, color: '#555', lineHeight: 1.5 }}>{c.gender === 'nu' ? 'nữ' : 'nam'} · {c.kind ?? 'misa'} · tóc {c.hair ?? ''}<br />{c.voice ?? ''}</div>
          </div>
          <div>
            <div style={{ display: 'flex', flexWrap: 'nowrap' }}>{POSE_LIST.map((p) => cell(p, p, <Person spec={c} pose={p} height={340} frame={f} mouth={mouth} />))}</div>
            <div style={{ display: 'flex', flexWrap: 'nowrap', marginTop: 10 }}>{EXPR_LIST.map((e) => cell(e, e, <div style={{ marginTop: 14, marginLeft: -215 }}><Person spec={c} pose="dung" expr={e} height={1200} frame={f} mouth={0} /></div>))}</div>
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
