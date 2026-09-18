import type { OrderStatus } from '~/data/operations';
export interface StoredItem { id: string; product_name: string; variant_description: string; quantity: number; unit_price_minor: number; line_total_minor: number }
export interface StoredEvent { id: string; kind: string; new_status: string; created_at: string }
export interface StoredOrder { id: string; revision: number; customer_name: string; customer_contact: string; source: string; status: OrderStatus; fulfillment: string; delivery_address: string | null; delivery_minor: number; scheduled_start: string; scheduled_end: string; note: string; is_demo: boolean; created_at: string; order_items: StoredItem[]; order_events: StoredEvent[] }
export interface StoredConversation { id: string; channel: string; mode: string; assigned_to: string | null; updated_at: string; customers: { display_name: string } | null }
export interface StoredMessage { id: string; sender: string; body: string; created_at: string }
export interface StoredKnowledge { id: string; slug: string; title: string; body: string; locale: 'ru' | 'en' | 'th'; visibility: 'public' | 'internal'; status: 'draft' | 'published' | 'archived'; version: number; updated_at: string }
