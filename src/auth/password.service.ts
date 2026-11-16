import { Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;

  async onModuleInit() {
    this.dummyHash = await this.hash(randomBytes(32).toString('hex'));
  }

  hash(password: string) {
    return Bun.password.hash(password, { algorithm: 'argon2id', memoryCost: 65536, timeCost: 3 });
  }

  async verify(password: string, hash?: string) {
    // An unknown account still pays a real password verification cost.
    // Old seed placeholders are invalid credentials, never plaintext passwords.
    const usable = hash?.startsWith('$argon2id$') ? hash : this.dummyHash;
    try {
      const matches = await Bun.password.verify(password, usable);
      return Boolean(hash?.startsWith('$argon2id$') && matches);
    } catch {
      await Bun.password.verify(password, this.dummyHash);
      return false;
    }
  }
}
