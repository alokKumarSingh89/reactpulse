import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incomingRequestId = request.header('x-request-id');

    const requestId = incomingRequestId || randomUUID();

    request.headers['x-request-id'] = requestId;

    response.setHeader('x-request-id', requestId);

    next();
  }
}
