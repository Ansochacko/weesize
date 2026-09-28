import type { StagedBytes } from '../lib/session';

export interface ToolApi {
  ingest(files: File[]): void;
  setDragging(on: boolean): void;
  loadHeld?(files: StagedBytes[]): void;
  onKeydown?(event: KeyboardEvent): boolean;
  applyPreset?(): void;
}
