# Central Seller HUB — Prompt Master para Claude Code

> Cole este conteúdo no campo de contexto do Claude Code (Antigravity).
> Ele define toda a arquitetura, regras e padrões do projeto.

---

## O QUE É ESTE SISTEMA

SaaS multi-tenant para centralizar operações de vendedores que atuam em múltiplos marketplaces (Mercado Livre, Shopee e Amazon) em um único painel. O sistema unifica:

- **Chat pós-venda** com histórico por pedido
- **Reclamações** com controle de SLA e alertas automáticos
- **Perguntas pré-venda** por marketplace
- **Dashboard** com KPIs em tempo real
- **Multi-CNPJ** — um vendedor pode ter N empresas, cada uma com N contas de marketplace
- **Automação com IA** — classificação automática de mensagens e sugestão de respostas

---

## STACK OBRIGATÓRIA

| Camada       | Tecnologia                          |
|--------------|-------------------------------------|
| Backend      | Node.js 20 + NestJS 10              |
| Banco        | PostgreSQL 15                       |
| Cache        | Redis 7                             |
| Filas        | RabbitMQ 3.12 + Bull (NestJS)       |
| Frontend     | React 18 + Next.js 14 (App Router)  |
| Realtime     | Socket.io (WebSocket)               |
| Auth         | OAuth 2.0 por marketplace + JWT     |
| ORM          | TypeORM                             |
| Infra        | Docker + Docker Compose (dev)       |
| Testes       | Jest + Supertest                    |
| Lint/Format  | ESLint + Prettier                   |

---

## ESTRUTURA DO PROJETO

```
central-seller/
├── backend/                        # NestJS API
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── guards/
│   │   │   │   └── tenant.guard.ts
│   │   │   ├── interceptors/
│   │   │   └── pipes/
│   │   ├── config/
│   │   │   ├── database.config.ts
│   │   │   ├── redis.config.ts
│   │   │   └── rabbitmq.config.ts
│   │   └── modules/
│   │       ├── accounts/           # Contas + CNPJ
│   │       ├── integration/        # Sync com ML, Shopee, Amazon
│   │       │   └── services/
│   │       │       ├── mercadolivre.service.ts
│   │       │       ├── shopee.service.ts
│   │       │       └── amazon.service.ts
│   │       ├── messaging/          # Chat + WebSocket
│   │       ├── complaints/         # Reclamações + SLA
│   │       ├── questions/          # Perguntas pré-venda
│   │       ├── dashboard/          # KPIs + métricas
│   │       ├── automation/         # IA + auto-reply
│   │       └── queues/             # RabbitMQ consumers
│   ├── test/
│   ├── .env                        # baseado no .env.example
│   └── package.json
│
├── frontend/                       # Next.js App
│   ├── app/
│   │   ├── (auth)/login/
│   │   └── (hub)/
│   │       ├── dashboard/
│   │       ├── chat/[id]/
│   │       ├── reclamacoes/
│   │       ├── perguntas/
│   │       └── contas/
│   ├── components/
│   │   ├── ConversationList.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── MetricCard.tsx
│   │   ├── SLABadge.tsx
│   │   └── MarketplaceBadge.tsx
│   ├── lib/
│   │   └── socket.ts
│   ├── .env.local                  # variáveis do frontend
│   └── package.json
│
├── docker-compose.yml              # PostgreSQL + Redis + RabbitMQ
├── .env.example                    # TODAS as variáveis necessárias
└── CLAUDE.md                       # este arquivo
```

---

## REGRAS DE CÓDIGO — SIGA SEMPRE

### Multi-tenancy (CRÍTICO)
```typescript
// SEMPRE filtrar por tenantId. NUNCA consultar sem ele.
// ERRADO:
return this.repo.find();

// CORRETO:
return this.repo.find({ where: { tenantId: ctx.tenantId } });
```

### Tokens OAuth (CRÍTICO)
```typescript
// NUNCA salvar access_token ou refresh_token em plaintext.
// Usar AES-256-GCM com chave via variável de ambiente (ENCRYPTION_KEY).
import { createCipheriv, randomBytes } from 'crypto';
```

### Paginação (OBRIGATÓRIO)
```typescript
// NUNCA usar OFFSET em tabelas grandes. SEMPRE cursor-based:
// WHERE id > :lastId ORDER BY id ASC LIMIT :limit
```

### Rate Limiting
```typescript
// Aplicar throttle por tenant_id + marketplace em todos os endpoints públicos.
@Throttle({ default: { limit: 60, ttl: 60000 } })
```

---

## MÓDULOS — O QUE CADA UM FAZ

### accounts
Gerencia empresas (CNPJs) e suas contas nos marketplaces. Cada conta tem um `access_token` e `refresh_token` criptografados. Responsável pelo refresh automático de tokens.

### integration
Sincroniza dados dos marketplaces em background (pedidos, mensagens, perguntas, reclamações). Usa filas RabbitMQ para processar sem bloquear a API.

### messaging
Centraliza todas as conversas. Expõe WebSocket via Socket.io para atualização em tempo real na UI. Cada mensagem tem `sender` (cliente | vendedor | bot).

### complaints
Gerencia reclamações com SLA automático. Alerta quando o prazo está vencendo. Prioridade: urgent → SLA 24h.

### questions
Gerencia perguntas pré-venda. Permite resposta manual ou automática via IA.

### dashboard
Agrega métricas por período, marketplace e CNPJ. Cache Redis com TTL de 60 segundos.

### automation
Classifica mensagens automaticamente usando palavras-chave e (futuramente) ML. Sugere respostas automáticas.

### queues
Consumers RabbitMQ para processar tarefas assíncronas. DLQ para mensagens que falham 3x.

---

## SLA — REGRAS DE NEGÓCIO

| Tipo           | Prazo    | Prioridade |
|----------------|----------|------------|
| Reclamação     | 24 horas | urgent     |
| Pós-venda      | 48 horas | high       |
| Pergunta       | 12 horas | normal     |

```typescript
function calcularSLA(tipo: 'reclamacao' | 'pos_venda' | 'pergunta'): Date {
  const horas = { reclamacao: 24, pos_venda: 48, pergunta: 12 };
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + horas[tipo]);
  return deadline;
}
```

---

## ENDPOINTS DE REFERÊNCIA DAS APIs

### Mercado Livre
| Ação            | Endpoint                                            |
|-----------------|-----------------------------------------------------|
| OAuth login     | `https://auth.mercadolivre.com.br/authorization`    |
| Token refresh   | `POST https://api.mercadolibre.com/oauth/token`     |
| Mensagens       | `GET /messages/packs/{pack_id}`                     |
| Perguntas       | `GET /questions/search?seller_id={id}&status=UNANSWERED` |
| Reclamações     | `GET /post-purchase/v1/claims/search?seller_id={id}` |
| Pedidos         | `GET /orders/search?seller={id}`                    |

### Shopee
| Ação            | Endpoint                                              |
|-----------------|-------------------------------------------------------|
| Auth            | HMAC-SHA256 em todos os requests                      |
| Token refresh   | `POST /api/v2/auth/access_token/get`                  |
| Conversas       | `POST /api/v2/message/get_conversation_list`          |
| Mensagens       | `POST /api/v2/message/get_message`                    |
| Enviar msg      | `POST /api/v2/message/send_message`                   |
| Pedidos         | `GET /api/v2/order/get_order_list`                    |

### Amazon SP-API
| Ação            | Endpoint                                                  |
|-----------------|-----------------------------------------------------------|
| Auth            | Login with Amazon (LWA) + AWS Signature v4                |
| Token refresh   | `POST https://api.amazon.com/auth/o2/token`               |
| Mensagens       | `GET /messaging/v1/orders/{orderId}/messages`             |
| Reclamações     | `GET /orders/v0/orders?OrderStatuses=Unshipped`           |
| Pedidos         | `GET /orders/v0/orders`                                   |

---

## PADRÕES DE RESPOSTA DA API

```typescript
// Sucesso
{ data: T, meta?: { total, page, cursor } }

// Erro
{ error: { code: string, message: string, details?: any } }
```

---

## FILAS RABBITMQ

```typescript
export const QUEUES = {
  RECLAMACOES: 'queue.reclamacoes',   // prioridade máxima
  POS_VENDA:   'queue.pos_venda',
  PERGUNTAS:   'queue.perguntas',
  SYNC_ML:     'queue.sync.mercadolivre',
  SYNC_SHOPEE: 'queue.sync.shopee',
  SYNC_AMAZON: 'queue.sync.amazon',
  NOTIFICATIONS: 'queue.notifications',
} as const;
```

---

## DOCKER COMPOSE (DEV)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: central_seller
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  rabbitmq:
    image: rabbitmq:3.12-management
    ports: ["5672:5672", "15672:15672"]
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}

volumes:
  pgdata:
```

---

## INSTRUÇÕES PARA O CLAUDE CODE

Quando receber uma tarefa neste projeto, siga esta ordem:

1. **Identifique o módulo** — em qual pasta do `src/modules/` a mudança se encaixa.
2. **Verifique multi-tenancy** — toda query precisa de `tenantId`.
3. **Use TypeORM** — entidades decoradas, repositórios injetados.
4. **Crie o teste** — todo service precisa de teste unitário em `*.spec.ts`.
5. **Valide com DTO** — use `class-validator` em todos os DTOs.
6. **Documente com Swagger** — use `@ApiProperty()` em todos os DTOs.
7. **Respeite a fila** — operações com marketplace vão para RabbitMQ, não chamam a API diretamente no request.

### Comandos úteis
```bash
# Instalar deps do backend
cd backend && npm install

# Rodar em dev
npm run start:dev

# Rodar testes
npm run test
npm run test:e2e

# Subir infra local
docker-compose up -d

# Migrations
npm run migration:generate -- src/migrations/NomeDaMigration
npm run migration:run
```

---

## CONTEXTO ATUAL DO PROJETO

- Repositório: `central-seller/`
- Branch principal: `main`
- Ambiente: desenvolvimento local com Docker
- Marketplaces integrados: Mercado Livre, Shopee, Amazon
- Modelo de negócio: SaaS multi-tenant (multi-CNPJ por cliente)
- Status: fase inicial de construção — prioridade nos módulos `integration`, `messaging` e `accounts`
