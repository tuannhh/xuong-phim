import type React from 'react';
import type { SceneProps } from '../scenes/common';

// Cảnh viết riêng cho một tập (khi không template nào hợp). Mỗi cảnh một file trong remotion/custom/<series>/,
// đăng ký ở đây với khoá "<series>/<TenCanh>", rồi dùng trong episode.json: { "type": "custom", "props": { "component": "<series>/<TenCanh>" } }.
export const CUSTOM: Record<string, React.FC<SceneProps>> = {};
