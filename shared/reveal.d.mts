export function revealFrames(scene: { beats: number[]; duration: number }, n: number, items?: any[], fps?: number): number[];
export function revealItems(scene: any): { items: any[]; sfx: string | ((it: any) => string) } | null;
export function storyTimes(scene: { beats?: number[]; duration: number; lines?: { from: number; to: number }[] }, items: any[], fps?: number): number[];
export const STORY_SFX: { pop: Record<string, string>; item: (it: any) => string };
