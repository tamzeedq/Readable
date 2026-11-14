// Packs a book's local content (text, images, cover) into one blob for cloud storage, and back.
import JSZip from 'jszip';
import type { BookContent, BookImage } from '../../types';
import { hashFile } from './files';

export async function packBookContent(content: BookContent, cover?: Blob): Promise<{ blob: Blob; hash: string }> {
  const zip = new JSZip();
  const images = [];
  for (let i = 0; i < content.images.length; i++) {
    const { blob, ...meta } = content.images[i];
    zip.file(`img-${i}`, await blob.arrayBuffer());
    images.push({ ...meta, file: `img-${i}`, type: blob.type });
  }
  zip.file('content.json', JSON.stringify({ ...content, images }));
  if (cover) zip.file('cover', await cover.arrayBuffer());
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  // Hash the text itself (not the zip, whose bytes vary) so identical books dedupe across devices.
  const hash = await hashFile(new TextEncoder().encode(`${content.words.length}:${content.words.join(' ')}`));
  return { blob, hash };
}

export async function unpackBookContent(bookId: string, data: Blob): Promise<{ content: BookContent; cover?: Blob }> {
  const zip = await JSZip.loadAsync(await data.arrayBuffer());
  const file = zip.file('content.json');
  if (!file) throw new Error('Book file is missing its content');
  const raw = JSON.parse(await file.async('string')) as Omit<BookContent, 'images'> & {
    images: (Omit<BookImage, 'blob'> & { file: string; type: string })[];
  };
  const images: BookImage[] = [];
  for (const { file: f, type, ...meta } of raw.images) {
    images.push({ ...meta, blob: new Blob([await zip.file(f)!.async('arraybuffer')], { type }) });
  }
  const cover = zip.file('cover');
  return {
    content: { ...raw, bookId, images },
    cover: cover ? new Blob([await cover.async('arraybuffer')]) : undefined,
  };
}
