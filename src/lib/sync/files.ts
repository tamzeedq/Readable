import type { SyncClient } from './engine';
import { SyncError } from './engine';

export const BOOKS_BUCKET = 'books';

export interface UploadResult {
  storagePath: string;
  /** false when an existing object with the same content hash was reused */
  uploaded: boolean;
}

/** Object path for a book's original file. The first segment must be the user id (storage RLS). */
export const bookObjectPath = (userId: string, bookId: string): string => `${userId}/${bookId}`;

/** Hex SHA-256 of the file, used as `content_hash`. */
export async function hashFile(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function userIdOf(client: SyncClient): Promise<string> {
  const { data } = await client.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new SyncError('Not signed in');
  return id;
}

/**
 * Upload a book's original file unless this user already has an object with the same content hash.
 * The book row must already exist (run syncOnce first). On success the row's content_hash and
 * storage_path are updated; the caller should record them in `snapshot.bookFiles` and stamp the book.
 */
export async function uploadBookFile(
  client: SyncClient,
  args: { bookId: string; data: Blob | ArrayBuffer | Uint8Array; contentHash: string; contentType?: string },
): Promise<UploadResult> {
  const userId = await userIdOf(client);
  const { data: existing, error: qErr } = await client
    .from('books')
    .select('storage_path')
    .eq('user_id', userId)
    .eq('content_hash', args.contentHash)
    .is('deleted_at', null)
    .not('storage_path', 'is', null)
    .limit(1);
  if (qErr) throw new SyncError(`Hash lookup failed: ${qErr.message}`, qErr);

  let storagePath = existing?.[0]?.storage_path ?? null;
  let uploaded = false;
  if (!storagePath) {
    storagePath = bookObjectPath(userId, args.bookId);
    const { error } = await client.storage
      .from(BOOKS_BUCKET)
      .upload(storagePath, args.data, { upsert: true, contentType: args.contentType ?? 'application/octet-stream' });
    if (error) throw new SyncError(`Upload failed: ${error.message}`, error);
    uploaded = true;
  }
  const { error: uErr } = await client
    .from('books')
    .update({ content_hash: args.contentHash, storage_path: storagePath })
    .eq('id', args.bookId)
    .eq('user_id', userId);
  if (uErr) throw new SyncError(`Could not record file on book: ${uErr.message}`, uErr);
  return { storagePath, uploaded };
}

export async function downloadBookFile(client: SyncClient, storagePath: string): Promise<Blob> {
  const { data, error } = await client.storage.from(BOOKS_BUCKET).download(storagePath);
  if (error || !data) throw new SyncError(`Download failed: ${error?.message ?? 'no data'}`, error);
  return data;
}

/**
 * Delete a book's file via the Storage API. The object is kept if another live book of the
 * same user still references it (shared by content hash). Returns whether an object was removed;
 * deleting another user's path removes nothing (storage RLS) and returns false.
 */
export async function deleteBookFile(client: SyncClient, storagePath: string, bookId?: string): Promise<boolean> {
  const userId = await userIdOf(client);
  let refs = client.from('books').select('id').eq('user_id', userId).eq('storage_path', storagePath).is('deleted_at', null);
  if (bookId) refs = refs.neq('id', bookId);
  const { data: others, error: rErr } = await refs.limit(1);
  if (rErr) throw new SyncError(`Reference check failed: ${rErr.message}`, rErr);
  if (others?.length) return false;

  const { data, error } = await client.storage.from(BOOKS_BUCKET).remove([storagePath]);
  if (error) throw new SyncError(`Delete failed: ${error.message}`, error);
  return (data?.length ?? 0) > 0;
}
