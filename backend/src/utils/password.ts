import bcrypt from "bcryptjs";

/** bcrypt cost factor shared by password hashing and refresh-token hashing. */
export const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
