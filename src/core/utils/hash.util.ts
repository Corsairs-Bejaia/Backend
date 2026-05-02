import * as bcrypt from 'bcrypt';

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, ROUNDS);
}
