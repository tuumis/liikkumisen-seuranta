// Tiedostot: lataus, valinta, jako (Web Share API) ja pilvikansio (File System Access API, Chrome/Edge).
// Ei verkkokutsuja: kaikki tiedostot kulkevat käyttäjän omien toimintojen kautta.

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  }
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Avaa tiedostonvalitsimen; null, jos käyttäjä peruu. */
export function pickTextFile(accept = '.json,application/json'): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Jako Web Share API:lla ("Tallenna Tiedostoihin"); jos ei tuettu, tiedosto ladataan.
 * @returns 'shared' | 'downloaded' | 'cancelled'
 */
export async function shareOrDownload(filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Muu virhe → varalla lataus.
    }
  }
  downloadText(filename, text);
  return 'downloaded';
}

export const supportsFolder = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker!({ id: 'liikkumisseuranta', mode: 'readwrite' });
}

/** Käyttöoikeus kansioon; request vaatii käyttäjän eleen (painallus). */
export async function folderPermission(handle: FileSystemDirectoryHandle, request: boolean): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  if ((await handle.queryPermission?.(opts)) === 'granted') return true;
  if (!request) return false;
  return (await handle.requestPermission?.(opts)) === 'granted';
}

export async function readFolderFile(handle: FileSystemDirectoryHandle, name: string): Promise<File | null> {
  try {
    return await (await handle.getFileHandle(name)).getFile();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotFoundError') return null;
    throw e;
  }
}

export async function writeFolderFile(handle: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const fh = await handle.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}
