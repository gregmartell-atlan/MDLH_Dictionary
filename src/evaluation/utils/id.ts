import { v4 as uuidv4 } from 'uuid';

export function createId(prefix?: string): string {
  const id = uuidv4();
  return prefix ? `${prefix}-${id}` : id;
}

export function pickFromPalette(seed: string, palette: readonly string[]): string {
  if (palette.length === 0) return '';
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
}

