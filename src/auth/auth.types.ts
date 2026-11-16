import type { Request } from 'express';
import type { User } from '../db/users';

export type PublicUser = Pick<User, 'id' | 'username' | 'email' | 'role' | 'createdAt'>;
export interface AuthenticatedUser extends PublicUser { sessionId: string }
export type AuthRequest = Request & { user?: AuthenticatedUser };

export function publicUser(user: PublicUser): PublicUser {
  return { id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt };
}
