export const QUEUES = {
  RECLAMACOES: 'queue.reclamacoes',
  POS_VENDA: 'queue.pos_venda',
  PERGUNTAS: 'queue.perguntas',
  SYNC_ML: 'queue.sync.mercadolivre',
  SYNC_SHOPEE: 'queue.sync.shopee',
  SYNC_AMAZON: 'queue.sync.amazon',
  NOTIFICATIONS: 'queue.notifications',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
