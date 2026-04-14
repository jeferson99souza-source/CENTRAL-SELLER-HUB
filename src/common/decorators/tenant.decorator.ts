import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface TenantContext {
  tenantId: string;
  userId: string;
}

const extractTenant = (_data: unknown, ctx: ExecutionContext): TenantContext => {
  const request = ctx.switchToHttp().getRequest();
  return {
    tenantId: request.user?.tenantId,
    userId: request.user?.sub,
  };
};

/**
 * Extrai o contexto do tenant do request autenticado.
 * Uso: @Tenant() ctx: TenantContext
 */
export const Tenant = createParamDecorator(extractTenant);

/**
 * Alias de Tenant para compatibilidade retroativa.
 * Retorna apenas o tenantId como string.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId;
  },
);
