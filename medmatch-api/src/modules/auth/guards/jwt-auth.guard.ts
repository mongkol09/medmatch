import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../auth.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('No access token provided');
        }

        try {
            const payload: JwtPayload = await this.jwt.verifyAsync(token, {
                secret: this.config.get<string>('JWT_SECRET'),
            });

            // Attach user payload to request
            (request as any).user = payload;

            // Check role-based access if @Roles() decorator is used
            const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
                ROLES_KEY,
                [context.getHandler(), context.getClass()],
            );

            if (requiredRoles && requiredRoles.length > 0) {
                if (!requiredRoles.includes(payload.role)) {
                    throw new UnauthorizedException('Insufficient permissions');
                }
            }

            return true;
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
