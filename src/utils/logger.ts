import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`method: ${req.method}`);
      console.log(`url: ${req.originalUrl}`);
    }
    next();
  }
}
