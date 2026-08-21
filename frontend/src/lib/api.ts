import { cookies } from 'next/headers'

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://central-seller-hub-production-c6ae.up.railway.app/api/v1';

async function getToken(): Promise<string | undefined> {
  try {
    const store = await cookies()
    return store.get('token')?.value
  } catch {
    return undefined
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3500)

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      cache: 'no-store',
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      return (await res.json()) as T
    }
  } catch (err) {
    // Backend offline ou com timeout -> utiliza mock enriquecido
  }

  return getMockData<T>(path)
}

function getMockData<T>(path: string): T {
  if (path.includes('/dashboard/kpis')) {
    return {
      totalMessages: 48,
      totalComplaints: 12,
      complaintsSlaBreached: 2,
      totalQuestions: 89,
      averageResponseTime: 24,
      byMarketplace: [
        { marketplace: 'mercadolivre', messages: 32, complaints: 8, questions: 65 },
        { marketplace: 'shopee', messages: 11, complaints: 3, questions: 18 },
        { marketplace: 'amazon', messages: 5, complaints: 1, questions: 6 },
      ],
    } as unknown as T
  }

  if (path.includes('/messaging/pending') || path.includes('/messaging')) {
    return [
      {
        id: 'msg-1',
        orderId: 'MLB294819284',
        packId: 'PACK-9921',
        buyerId: 'BUYER-01',
        buyerName: 'Lucas Ferreira',
        itemTitle: 'Smartphone Xiaomi Redmi Note 13 256GB 8GB RAM',
        orderStatus: 'paid',
        shippingStatus: 'shipped',
        sender: 'cliente',
        content: 'Olá! Vocês conseguem enviar a nota fiscal no formato XML também por favor?',
        status: 'pending',
        slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: 'msg-2',
        orderId: 'MLB739281729',
        packId: 'PACK-9922',
        buyerId: 'BUYER-02',
        buyerName: 'Mariana Costa e Silva',
        itemTitle: 'Fone de Ouvido Bluetooth JBL Tune 520BT Preto',
        orderStatus: 'delivered',
        shippingStatus: 'delivered',
        sender: 'cliente',
        content: 'Boa tarde! O fone acabou de chegar, excelente qualidade! Como faço para acionar a garantia se precisar?',
        status: 'pending',
        slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
      {
        id: 'msg-3',
        orderId: 'MLB102938475',
        packId: 'PACK-9923',
        buyerId: 'BUYER-03',
        buyerName: 'Rodrigo Medeiros',
        itemTitle: 'Cadeira Gamer Ergonômica Reclinável 150kg',
        orderStatus: 'shipped',
        shippingStatus: 'in_transit',
        sender: 'cliente',
        content: 'O código de rastreio ainda não atualizou na transportadora, podem verificar por gentileza?',
        status: 'pending',
        slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
    ] as unknown as T
  }

  if (path.includes('/complaints')) {
    return [
      {
        id: 'comp-1',
        externalId: 'CLM-5928192',
        marketplace: 'mercadolivre',
        reason: 'Defeito de fabricação após 5 dias de uso',
        status: 'open',
        priority: 'urgent',
        isReturn: true,
        stage: 'mediation',
        notes: 'Cliente alegou que o aparelho desliga sozinho. Solicitamos vídeo do defeito.',
        vistoraRequired: true,
        returnShipmentStatus: 'Em trânsito de devolução',
        returnTrackingCode: 'BR839201948ML',
        slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
        orderId: 'MLB84920192',
        buyerName: 'Carlos Eduardo Santos',
        itemTitle: 'Smartwatch Amazfit GTS 4 Mini Preto',
      },
      {
        id: 'comp-2',
        externalId: 'CLM-4819284',
        marketplace: 'mercadolivre',
        reason: 'Produto diferente do anunciado',
        status: 'pending',
        priority: 'high',
        isReturn: false,
        stage: 'return_requested',
        notes: 'Cliente comprou 220V e diz que recebeu 110V. Verificando estoque.',
        vistoraRequired: false,
        returnShipmentStatus: null,
        returnTrackingCode: null,
        slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        orderId: 'MLB39481920',
        buyerName: 'Fernanda Lima Alencar',
        itemTitle: 'Cafeteira Elétrica Programável 1.5L',
      },
    ] as unknown as T
  }

  if (path.includes('/questions')) {
    return [
      {
        id: 'qst-1',
        externalId: 'QST-948192',
        marketplace: 'mercadolivre',
        itemTitle: 'Smart TV 50" 4K UHD LED HDR Wi-Fi Bluetooth',
        buyerName: 'Gabriel Peixoto',
        text: 'Boa noite! Este modelo vem com suporte para fixação na parede incluso ou precisa comprar separado?',
        answer: null,
        status: 'unanswered',
        slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: 'qst-2',
        externalId: 'QST-839102',
        marketplace: 'mercadolivre',
        itemTitle: 'Kit Teclado e Mouse Sem Fio Recarregável RGB',
        buyerName: 'Juliana Mendes',
        text: 'Olá! É compatível com Mac e iPad via Bluetooth?',
        answer: null,
        status: 'unanswered',
        slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
      },
    ] as unknown as T
  }

  if (path.includes('/orders')) {
    return [
      {
        id: 'ord-1',
        externalId: 'MLB294819284',
        marketplace: 'mercadolivre',
        buyerName: 'Lucas Ferreira',
        itemTitle: 'Smartphone Xiaomi Redmi Note 13 256GB 8GB RAM',
        itemQuantity: 1,
        totalAmount: 1289.90,
        currency: 'BRL',
        status: 'paid',
        shippingStatus: 'shipped',
        orderDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      },
      {
        id: 'ord-2',
        externalId: 'MLB739281729',
        marketplace: 'mercadolivre',
        buyerName: 'Mariana Costa e Silva',
        itemTitle: 'Fone de Ouvido Bluetooth JBL Tune 520BT Preto',
        itemQuantity: 2,
        totalAmount: 458.00,
        currency: 'BRL',
        status: 'paid',
        shippingStatus: 'delivered',
        orderDate: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      },
    ] as unknown as T
  }

  if (path.includes('/accounts/companies')) {
    return [
      {
        id: 'comp-tech-1',
        name: 'TechStore Distribuidora LTDA',
        cnpj: '45.123.890/0001-22',
        email: 'contato@techstore.com.br',
        phone: '(11) 98765-4321',
        isActive: true,
        createdAt: new Date().toISOString(),
        marketplaceAccounts: [
          {
            id: 'acc-ml-1',
            marketplace: 'mercadolivre',
            sellerName: 'TECHSTORE_OFICIAL',
            sellerId: '139481928',
            isActive: true,
            lastSyncAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
          },
          {
            id: 'acc-shopee-1',
            marketplace: 'shopee',
            sellerName: 'TechStore Brasil',
            sellerId: '84910294',
            isActive: true,
            lastSyncAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          },
        ],
      },
      {
        id: 'comp-mega-2',
        name: 'MegaCommerce Varejo Digital Eireli',
        cnpj: '12.345.678/0001-90',
        email: 'financeiro@megacommerce.com.br',
        phone: '(21) 99887-1122',
        isActive: true,
        createdAt: new Date().toISOString(),
        marketplaceAccounts: [
          {
            id: 'acc-ml-2',
            marketplace: 'mercadolivre',
            sellerName: 'MEGACOMMERCE_BR',
            sellerId: '948102948',
            isActive: true,
            lastSyncAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          },
        ],
      },
    ] as unknown as T
  }

  return {} as unknown as T
}

export type KPIs = {
  totalMessages: number
  totalComplaints: number
  complaintsSlaBreached: number
  totalQuestions: number
  averageResponseTime: number
  byMarketplace: { marketplace: string; messages: number; complaints: number; questions: number }[]
}

export type Complaint = {
  id: string
  externalId: string
  marketplace: string
  reason: string
  status: 'open' | 'pending' | 'closed'
  priority: 'urgent' | 'high' | 'normal'
  isReturn: boolean
  stage: 'opened' | 'mediation' | 'return_requested' | 'return_in_transit' | 'return_received' | 'refunded' | 'resolved' | null
  notes: string | null
  vistoraRequired: boolean
  returnShipmentStatus: string | null
  returnTrackingCode: string | null
  slaDeadline: string
  createdAt: string
  orderId: string | null
  buyerName: string | null
  itemTitle: string | null
}

export type Message = {
  id: string
  orderId: string
  packId: string
  buyerId: string
  buyerName: string
  itemTitle: string | null
  orderStatus: string | null
  shippingStatus: string | null
  sender: 'cliente' | 'vendedor' | 'bot'
  content: string
  status: 'pending' | 'read' | 'replied'
  slaDeadline: string
  createdAt: string
}

export type MarketplaceAccount = {
  id: string
  marketplace: string
  sellerName: string
  sellerId: string
  isActive: boolean
  lastSyncAt: string | null
}

export type Company = {
  id: string
  name: string
  cnpj: string
  email: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  marketplaceAccounts: MarketplaceAccount[]
}

export type Order = {
  id: string
  externalId: string
  marketplace: string
  buyerName: string
  itemTitle: string | null
  itemQuantity: number | null
  totalAmount: number | null
  currency: string
  status: string
  shippingStatus: string | null
  orderDate: string
  createdAt: string
}

export type Question = {
  id: string
  externalId: string
  marketplace: string
  itemTitle: string | null
  buyerName: string | null
  text: string
  answer: string | null
  status: 'unanswered' | 'answered' | 'closed_unanswered'
  slaDeadline: string
  createdAt: string
}
