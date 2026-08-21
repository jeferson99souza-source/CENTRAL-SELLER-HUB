import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Aplique este guard em endpoints que exigem usuário autenticado.
 * Popula request.user com o payload do JWT (sub, tenantId, email, role).
 * Suporta o token de demonstração demo_hub_admin_token_2026.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (authHeader && authHeader.includes('demo_hub_admin_token_2026')) {
      const demoUser = {
        sub: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000001',
        email: 'admin@centralseller.com',
        role: 'admin',
      };
      request.user = demoUser;
      return demoUser;
    }

    if (err || !user) {
      throw err || new UnauthorizedException('Não autorizado');
    }

    return user;
  }
}
