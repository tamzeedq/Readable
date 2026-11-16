import { describe, expect, it, vi } from 'vitest';
import type { SyncClient } from './engine';
import { deleteBookFile, uploadBookFile } from './files';

const USER = '11111111-1111-4111-8111-111111111111';

/** Minimal chainable stand-in for supabase-js. `rows` is what any books select resolves to. */
function mockClient(rows: unknown[]) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ data: [{ name: 'x' }], error: null });
  const update = vi.fn();
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'is', 'not']) chain[m] = () => chain;
  chain.limit = () => Promise.resolve({ data: rows, error: null });
  chain.update = (v: unknown) => {
    update(v);
    const u: Record<string, unknown> = {};
    u.eq = () => u;
    u.then = (res: (v: unknown) => unknown) => res({ error: null });
    return u;
  };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: USER } } } }) },
    from: () => chain,
    storage: { from: () => ({ upload, remove }) },
  } as unknown as SyncClient;
  return { client, upload, remove, update };
}

describe('uploadBookFile', () => {
  it('skips the upload and reuses the path when the hash already exists', async () => {
    const m = mockClient([{ storage_path: `${USER}/other-book` }]);
    const r = await uploadBookFile(m.client, { bookId: 'b2', data: new Uint8Array([1]), contentHash: 'h' });
    expect(r).toEqual({ storagePath: `${USER}/other-book`, uploaded: false });
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.update).toHaveBeenCalledWith({ content_hash: 'h', storage_path: `${USER}/other-book` });
  });

  it('uploads to {user}/{book} when the hash is new', async () => {
    const m = mockClient([]);
    const r = await uploadBookFile(m.client, { bookId: 'b1', data: new Uint8Array([1]), contentHash: 'h' });
    expect(r).toEqual({ storagePath: `${USER}/b1`, uploaded: true });
    expect(m.upload).toHaveBeenCalledTimes(1);
    expect(m.upload.mock.calls[0][0]).toBe(`${USER}/b1`);
  });
});

describe('deleteBookFile', () => {
  it('keeps the object while another live book references it', async () => {
    const m = mockClient([{ id: 'other' }]);
    expect(await deleteBookFile(m.client, `${USER}/b1`, 'b1')).toBe(false);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it('removes the object when unreferenced', async () => {
    const m = mockClient([]);
    expect(await deleteBookFile(m.client, `${USER}/b1`, 'b1')).toBe(true);
    expect(m.remove).toHaveBeenCalledWith([`${USER}/b1`]);
  });

  it('reports false when storage removed nothing (e.g. another user’s object)', async () => {
    const m = mockClient([]);
    m.remove.mockResolvedValue({ data: [], error: null });
    expect(await deleteBookFile(m.client, 'someone-else/b', 'b')).toBe(false);
  });
});
