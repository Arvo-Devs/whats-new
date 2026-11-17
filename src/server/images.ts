// Pictures for posts and emails. Kept in the app's own database, so an app
// needs no file storage to use What's New, and served to anyone from
// <basePath>/images/<id>: emails load them from there.
//
// Only PNG, JPEG, GIF and WebP, told apart by their first bytes, never by the
// name or the type the browser claims. No SVG: it can carry script.
import { randomUUID } from 'node:crypto';
import type { WhatsNewSql } from '../config';
import { LIMITS } from '../shared/limits';

export type ImageType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

/** The picture's type from its first bytes; null when it is none of the four. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return 'image/png';
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'image/gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}

/**
 * Keeps a picture. Pictures are never removed on their own: a post or an
 * email uses one by its link, inside HTML the package can't follow, so only
 * a person knows when one is no longer needed.
 */
export async function saveImage(sql: WhatsNewSql, bytes: Uint8Array, type: ImageType, by: string): Promise<string> {
  const id = randomUUID();
  await sql`insert into whats_new_images (id, content_type, bytes, created_by) values (${id}, ${type}, ${Buffer.from(bytes)}, ${by})`;
  return id;
}

/** The pictures uploaded so far, newest first, without their bytes. */
export async function listImages(sql: WhatsNewSql, limit = 200): Promise<{ id: string; type: string; bytes: number; createdAt: string }[]> {
  const rows = await sql<{ id: string; content_type: string; size: number; created_at: Date }[]>`
    select id, content_type, octet_length(bytes)::int as size, created_at from whats_new_images order by created_at desc limit ${limit}
  `;
  return rows.map((row) => ({ id: row.id, type: row.content_type, bytes: row.size, createdAt: row.created_at.toISOString() }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The picture as an answer anyone may load, or not found. Its address never changes what it shows, so it is kept a year. */
export async function imageResponse(sql: WhatsNewSql, id: string): Promise<Response | null> {
  if (!UUID.test(id)) return null;
  const rows = await sql<{ content_type: string; bytes: Uint8Array }[]>`select content_type, bytes from whats_new_images where id = ${id}`;
  const row = rows[0];
  if (!row) return null;
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      'content-type': row.content_type,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
      'cross-origin-resource-policy': 'cross-origin',
    },
  });
}

export function tooBig(bytes: Uint8Array | null): boolean {
  return !bytes || bytes.byteLength > LIMITS.imageBytes;
}
