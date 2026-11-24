import type { ClientConfig } from 'pg';

/**
 * SupabaseのSession poolerは中間証明書が自己署名扱いになることがあり、
 * 標準の `sslmode=require` だと Node.js の pg が
 * `SELF_SIGNED_CERT_IN_CHAIN` で接続に失敗する。
 *
 * libpq の `sslmode=require`（暗号化はするがCA検証はしない）に合わせ、
 * require / prefer / verify-ca の場合は証明書検証を無効化して接続する。
 * 厳密にCA検証したい場合は `sslmode=verify-full` を使う。
 */
export function createPgConfig(connectionString: string): ClientConfig {
  const url = new URL(connectionString);
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode === 'require' || sslmode === 'prefer' || sslmode === 'verify-ca') {
    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');
    return {
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
    };
  }
  return { connectionString };
}
