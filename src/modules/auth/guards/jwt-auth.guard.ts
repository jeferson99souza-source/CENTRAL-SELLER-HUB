import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Aplique este guard em endpoints que exigem usuário autenticado.
 * Popula request.user com o payload do JWT (sub, tenantId, email, role).
 *
 * Uso: @UseGuards(JwtAuthGuard)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
