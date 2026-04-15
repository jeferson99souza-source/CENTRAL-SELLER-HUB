import { cookies } from 'next/headers'

const API_URL = process.env.API_URL!

async function getToken(): Promise<string | undefined> {
  const store = await cookies()
  return store.get('token')?.value
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
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
