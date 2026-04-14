import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard que garante que toda requisição tem um tenantId válido no JWT.
 * Aplique em controllers ou globalmente para proteger multi-tenancy.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.tenantId) {
      throw new ForbiddenException('Tenant ID não encontrado no token.');
    }

    return true;
  }
}
