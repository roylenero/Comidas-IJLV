import { MENU_IMAGE_LIMITS } from '../config/business';
import { AppError } from './errors';
import type { MenuAsset } from '../types/models';

/** Dimensiones que caben en `max` px por el lado mayor, sin agrandar. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Tamaño aproximado en bytes que ocupará el Data URL dentro del documento de Firestore. */
export function dataUrlBytes(dataUrl: string): number {
  return new Blob([dataUrl]).size;
}

const QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42];

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Se intenta abajo con <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Redimensiona y comprime la imagen del menú en el navegador (WebP, o JPEG si el
 * navegador no sabe codificar WebP) hasta que quepa en el límite seguro para Firestore.
 */
export async function compressMenuImage(file: File): Promise<MenuAsset> {
  const { maxDimension, minDimension, maxDataUrlBytes, acceptedTypes } = MENU_IMAGE_LIMITS;
  if (!(acceptedTypes as readonly string[]).includes(file.type)) {
    throw new AppError('validation', 'Formato no admitido. Usa una imagen JPG, PNG o WebP.');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new AppError('validation', 'La imagen pesa más de 25 MB. Exporta una versión más ligera.');
  }

  let source: CanvasImageSource & { width: number; height: number };
  try {
    source = await loadImage(file);
  } catch {
    throw new AppError('validation', 'No se pudo leer la imagen. Prueba con otro archivo.');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('unknown', 'Tu navegador no permite procesar imágenes.');

  let maxSide: number = maxDimension;
  while (maxSide >= minDimension) {
    const { width, height } = fitWithin(source.width, source.height, maxSide);
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia al pasar a JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    for (const quality of QUALITIES) {
      let dataUrl = canvas.toDataURL('image/webp', quality);
      let mimeType = 'image/webp';
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        mimeType = 'image/jpeg';
      }
      const bytes = dataUrlBytes(dataUrl);
      if (bytes <= maxDataUrlBytes) return { dataUrl, mimeType, width, height, bytes };
    }
    maxSide = Math.floor(maxSide * 0.8);
  }

  throw new AppError(
    'validation',
    'No fue posible reducir la imagen a un tamaño seguro (600 KB). Usa una imagen con menos detalle o recórtala.',
  );
}
