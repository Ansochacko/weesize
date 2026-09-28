interface FileEntry {
  isFile: true;
  isDirectory: false;
  file(success: (file: File) => void, error?: (reason: DOMException) => void): void;
}

interface DirectoryEntry {
  isFile: false;
  isDirectory: true;
  createReader(): {
    readEntries(success: (entries: Entry[]) => void, error?: (reason: DOMException) => void): void;
  };
}

type Entry = FileEntry | DirectoryEntry;

function asEntry(item: DataTransferItem): Entry | null {
  const raw = item.webkitGetAsEntry?.() ?? null;
  return raw ? (raw as unknown as Entry) : null;
}

async function readFile(entry: FileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readDirectory(entry: DirectoryEntry): Promise<Entry[]> {
  const reader = entry.createReader();
  const all: Entry[] = [];
  for (;;) {
    const batch = await new Promise<Entry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

async function walk(entry: Entry, into: File[]): Promise<void> {
  if (entry.isFile) {
    into.push(await readFile(entry));
    return;
  }
  if (entry.isDirectory) {
    for (const child of await readDirectory(entry)) await walk(child, into);
  }
}

/** Files from a drop, including the contents of any folders. */
export async function filesFromDataTransfer(data: DataTransfer): Promise<File[]> {
  const entries = [...data.items].map(asEntry).filter((entry): entry is Entry => entry !== null);
  if (entries.length === 0) return [...data.files];
  const files: File[] = [];
  for (const entry of entries) await walk(entry, files);
  return files.length > 0 ? files : [...data.files];
}
