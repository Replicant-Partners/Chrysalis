import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type ApiKeyId = string;

export type ApiKeyRecord = {
  id: ApiKeyId;
  name: string;
  createdAt: string;
  hashHex: string; // sha384(secret)
  role?: 'admin' | 'user';
  revokedAt?: string;
};

export type ApiKeyFile = {
  version: 1;
  keys: ApiKeyRecord[];
};

export type NewApiKey = {
  id: ApiKeyId;
  secret: string;
  name: string;
  createdAt: string;
};

export class ApiKeyStore {
  constructor(private readonly filePath: string) {}

  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  ensureDir(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
  }

  load(): ApiKeyFile {
    if (!this.exists()) return { version: 1, keys: [] };
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed?.keys)) return { version: 1, keys: [] };
    return parsed as ApiKeyFile;
  }

  save(file: ApiKeyFile): void {
    this.ensureDir();
    fs.writeFileSync(this.filePath, JSON.stringify(file, null, 2));
  }

  mint(name: string, role: 'admin' | 'user' = 'user'): { key: NewApiKey; file: ApiKeyFile } {
    const createdAt = new Date().toISOString();
    const id = `k_${crypto.randomBytes(9).toString('hex')}`;
    const secret = crypto.randomBytes(32).toString('base64url');
    const hashHex = sha384Hex(secret);

    const file = this.load();
    const record: ApiKeyRecord = { id, name, createdAt, hashHex, role };
    file.keys.push(record);
    this.save(file);

    return { key: { id, secret, name, createdAt }, file };
  }

  verify(bearerToken: string): { ok: true; keyId: string } | { ok: false; reason: string } {
    const token = bearerToken.trim();
    const parts = token.split('.', 2);
    if (parts.length !== 2) return { ok: false, reason: 'bad_token_format' };
    const [id, secret] = parts;
    if (!id || !secret) return { ok: false, reason: 'bad_token_format' };

    const file = this.load();
    const rec = file.keys.find((k) => k.id === id);
    if (!rec) return { ok: false, reason: 'unknown_key' };
    if (rec.revokedAt) return { ok: false, reason: 'revoked_key' };

    const hashHex = sha384Hex(secret);
    if (hashHex !== rec.hashHex) return { ok: false, reason: 'invalid_secret' };
    return { ok: true, keyId: id };
  }

  isAdmin(keyId: string): boolean {
    const file = this.load();
    const rec = file.keys.find((k) => k.id === keyId);
    return rec?.role === 'admin';
  }
}

function sha384Hex(input: string): string {
  return crypto.createHash('sha384').update(input, 'utf8').digest('hex');
}
