// Kuvan pienennys laitteella (SPEC 11, lisäys 16): rajataan keskeltä neliöksi ja tallennetaan
// pienenä JPEG-data-URL:na. Alkuperäistä kuvaa ei säilytetä eikä lähetetä minnekään.

export const PHOTO_SIZE = 256;
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Hyväksytty kuvan muoto (myös tuonnissa): pieni base64-data-URL. */
export function isPhotoDataUrl(s: unknown): s is string {
  return typeof s === 'string' && s.length <= 300_000 && PHOTO_RE.test(s);
}

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Safarin vanhemmat versiot: varareitti alla.
    }
  }
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Kuvaa ei voitu lukea'));
    r.readAsDataURL(file);
  });
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Tiedosto ei ole tuettu kuva'));
    img.src = url;
  });
}

/** Pienentää kuvan neliöksi (oletus 256 px) ja palauttaa JPEG-data-URL:n. */
export async function resizePhoto(file: Blob, size = PHOTO_SIZE): Promise<string> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Valitse kuvatiedosto');
  const img = await decode(file);
  const side = Math.min(img.width, img.height);
  if (!side) throw new Error('Kuvaa ei voitu lukea');
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  const out = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kuvan käsittely ei onnistu tällä selaimella');
  ctx.fillStyle = '#ffffff'; // läpinäkyvä tausta valkoiseksi (JPEG)
  ctx.fillRect(0, 0, out, out);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
  if ('close' in img && typeof img.close === 'function') img.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Logo kokonaisena (joukkuekirjasto): ei rajausta, kuvasuhde säilyy ja pisin sivu on enintään
 * `size`. PNG säilyttää läpinäkyvän taustan; liian suuri PNG tallennetaan JPEG:nä valkoisella taustalla.
 */
export async function resizeLogo(file: Blob, size = 320): Promise<string> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Valitse kuvatiedosto');
  const img = await decode(file);
  if (!img.width || !img.height) throw new Error('Kuvaa ei voitu lukea');
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kuvan käsittely ei onnistu tällä selaimella');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  if ('close' in img && typeof img.close === 'function') img.close();
  const png = canvas.toDataURL('image/png');
  if (isPhotoDataUrl(png)) return png;
  const flat = document.createElement('canvas');
  flat.width = w;
  flat.height = h;
  const f = flat.getContext('2d')!;
  f.fillStyle = '#ffffff';
  f.fillRect(0, 0, w, h);
  f.drawImage(canvas, 0, 0);
  return flat.toDataURL('image/jpeg', 0.88);
}
