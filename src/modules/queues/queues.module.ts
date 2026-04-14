import { Module } from '@nestjs/common';

/**
 * Módulo de filas RabbitMQ.
 * Consumers processam mensagens de cada fila de forma assíncrona.
 * DLQ (Dead Letter Queue) para mensagens que falham 3x.
 */
@Module({
  providers: [],
  exports: [],
})
export class QueuesModule {}
