export interface QueueEvent {
  file: string;
  ok: boolean;
  detail: string;
  savedBytes: number;
}

export function outputName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}-copy.pdf`;
}

/** Runs a folder queue without touching the original name. One failure does not stop the rest. */
export async function runHotQueue(
  files: string[],
  work: (file: string) => Promise<{ savedBytes: number }>,
  paused: () => boolean,
): Promise<QueueEvent[]> {
  const events: QueueEvent[] = [];
  for (const file of files) {
    if (paused()) {
      events.push({ file, ok: false, detail: 'Paused before this file.', savedBytes: 0 });
      continue;
    }
    if (outputName(file) === file) {
      events.push({ file, ok: false, detail: 'Refused, because the output name would replace the original.', savedBytes: 0 });
      continue;
    }
    try {
      const result = await work(file);
      events.push({ file, ok: true, detail: `Copied ${outputName(file)}. It was not compressed. The original was left in place.`, savedBytes: result.savedBytes });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'This file failed.';
      events.push({ file, ok: false, detail, savedBytes: 0 });
    }
  }
  return events;
}
