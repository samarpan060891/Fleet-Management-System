import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';

// File-storage abstraction. `local` writes to disk; `s3` is designed for any
// S3-compatible endpoint (UAE-region friendly). Returns an opaque `key` stored
// on records; download resolves the key back to bytes/URL.
export interface StorageDriver {
  save(buffer: Buffer, opts: { filename: string; mime: string }): Promise<string>;
  getPath(key: string): string;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements StorageDriver {
  constructor(private dir: string) {
    fs.mkdirSync(this.dir, { recursive: true });
  }

  async save(buffer: Buffer, opts: { filename: string; mime: string }): Promise<string> {
    const ext = path.extname(opts.filename) || '';
    const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${ext}`;
    const full = path.join(this.dir, key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, buffer);
    return key;
  }

  getPath(key: string): string {
    return path.join(this.dir, key);
  }

  async exists(key: string): Promise<boolean> {
    return fs.promises
      .access(this.getPath(key))
      .then(() => true)
      .catch(() => false);
  }

  async remove(key: string): Promise<void> {
    await fs.promises.unlink(this.getPath(key)).catch(() => undefined);
  }
}

// Note: the S3 driver intentionally shares the same interface. The AWS SDK is
// left out of dependencies to keep the default (local) build lean; wire it in
// when STORAGE_DRIVER=s3. See /docs/DECISIONS.md.
class S3StorageNotConfigured implements StorageDriver {
  async save(): Promise<string> {
    throw new Error(
      'S3 storage selected but not wired. Install @aws-sdk/client-s3 and implement S3Storage.'
    );
  }
  getPath(): string {
    throw new Error('S3 storage not wired');
  }
  async exists(): Promise<boolean> {
    return false;
  }
  async remove(): Promise<void> {}
}

export const storage: StorageDriver =
  env.storage.driver === 's3' ? new S3StorageNotConfigured() : new LocalStorage(env.storage.localDir);
