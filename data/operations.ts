import { L } from './atelier';
import type { Localized } from './atelier';
export type OrderStatus = 'pending' | 'confirmed' | 'production' | 'ready' | 'completed' | 'cancelled';
export type OrderItem = {
  name: string;
  quantity: number;
  price: number;
  detail: string;
};
export type DemoOrder = {
  id: string;
  requestKey: string;
  source: 'website' | 'chat';
  conversationId?: string;
  customer: string;
  contact: string;
  date: string;
  slot: string;
  mode: 'pickup' | 'delivery';
  address: string;
  note: string;
  items: OrderItem[];
  delivery: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  history: {
    at: string;
    text: string;
  }[];
};
export type ChatMessage = {
  id: string;
  role: 'customer' | 'assistant' | 'manager';
  text: string;
  at: string;
  source?: string;
};
export type Conversation = {
  id: string;
  name: string;
  mode: 'bot' | 'requested' | 'manager';
  messages: ChatMessage[];
};
export type KnowledgeArticle = {
  id: string;
  title: string;
  answers: Localized;
  keywords: string;
  status: 'draft' | 'published';
  updatedAt: string;
};
export type OperationsState = {
  version: 1;
  orders: DemoOrder[];
  conversations: Conversation[];
  knowledge: KnowledgeArticle[];
};
export const statuses: {
  id: OrderStatus;
  label: string;
}[] = [{
  id: 'pending',
  label: 'На проверке'
}, {
  id: 'confirmed',
  label: 'Подтверждён'
}, {
  id: 'production',
  label: 'В работе'
}, {
  id: 'ready',
  label: 'Готов к выдаче'
}, {
  id: 'completed',
  label: 'Завершён'
}, {
  id: 'cancelled',
  label: 'Отменён'
}];
export const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['production', 'cancelled'],
  production: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};
export function bangkokDate(offset = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day') + offset)).toISOString().slice(0, 10);
}
export function seedOperations(): OperationsState {
  const now = new Date().toISOString();
  return {
    version: 1,
    orders: [{
      id: 'DEMO-1001',
      requestKey: 'seed-1',
      source: 'website',
      customer: 'Анна · пример',
      contact: 'demo@example.com',
      date: bangkokDate(2),
      slot: '10:00–12:00',
      mode: 'pickup',
      address: '',
      note: 'Надпись: С днём рождения!',
      items: [{
        name: 'Ягодное облако',
        quantity: 1,
        price: 1450,
        detail: '1 кг'
      }],
      delivery: 0,
      total: 1450,
      status: 'pending',
      createdAt: now,
      history: [{
        at: now,
        text: 'Создан демонстрационный заказ'
      }]
    }, {
      id: 'DEMO-1002',
      requestKey: 'seed-2',
      source: 'chat',
      customer: 'Alex · example',
      contact: 'alex@example.com',
      date: bangkokDate(1),
      slot: '12:00–15:00',
      mode: 'delivery',
      address: 'Тестовый отель, Джомтьен',
      note: 'Подарок гостю отеля',
      items: [{
        name: 'Шоколадные истории',
        quantity: 2,
        price: 490,
        detail: '6 шт.'
      }],
      delivery: 180,
      total: 1160,
      status: 'production',
      createdAt: now,
      history: [{
        at: now,
        text: 'Демонстрационный заказ в производстве'
      }]
    }, {
      id: 'DEMO-1003',
      requestKey: 'seed-3',
      source: 'website',
      customer: 'Май · пример',
      contact: 'mai@example.com',
      date: bangkokDate(),
      slot: '15:00–18:00',
      mode: 'pickup',
      address: '',
      note: '',
      items: [{
        name: 'Малиновые поцелуи',
        quantity: 1,
        price: 590,
        detail: '6 шт.'
      }],
      delivery: 0,
      total: 590,
      status: 'ready',
      createdAt: now,
      history: [{
        at: now,
        text: 'Демонстрационный заказ готов к выдаче'
      }]
    }],
    conversations: [{
      id: 'web-demo',
      name: 'Посетитель сайта · вы',
      mode: 'bot',
      messages: []
    }],
    knowledge: [{
      id: 'opening',
      title: 'Открытие и местоположение',
      answers: L('Мы планируем кондитерскую в Паттайе. Точный адрес и дата открытия пока не определены. Сейчас доступен только прототип.', 'We are planning a patisserie in Pattaya. The address and opening date are not confirmed. This is currently a prototype.', 'เรากำลังวางแผนร้านขนมในพัทยา ยังไม่กำหนดที่อยู่และวันเปิด ขณะนี้เป็นต้นแบบ'),
      keywords: 'адрес,открыт,где,когда,работает,location,address,open,where,ที่อยู่,เปิด,อยู่ที่',
      status: 'published',
      updatedAt: now
    }, {
      id: 'collection',
      title: 'Планируемая коллекция',
      answers: L('Планируем торты, капкейки, имбирные пряники и шоколадные конфеты ручной работы. В каталоге сейчас примеры товаров и цен.', 'We plan cakes, cupcakes, gingerbread and handmade chocolates. The catalog currently contains sample products and prices.', 'เราวางแผนขายเค้ก คัพเค้ก ขนมปังขิง และช็อกโกแลตทำมือ สินค้าและราคาในแคตตาล็อกเป็นตัวอย่าง'),
      keywords: 'ассортимент,прода,десерт,каталог,collection,catalog,treats,สินค้า,ขนม',
      status: 'published',
      updatedAt: now
    }, {
      id: 'cafe',
      title: 'Концепция кофейни',
      answers: L('На выдаче планируется небольшая кофейня на 5–6 столиков. Меню, адрес и часы работы ещё не утверждены.', 'A small café with 5–6 tables is planned at the pickup point. The menu, address and opening hours are not final.', 'มีแผนคาเฟ่เล็ก ๆ ประมาณ 5–6 โต๊ะที่จุดรับสินค้า เมนู ที่อยู่ และเวลาเปิดยังไม่สรุป'),
      keywords: 'кофе,кофей,столик,café,cafe,coffee,คาเฟ่,กาแฟ',
      status: 'published',
      updatedAt: now
    }, {
      id: 'delivery',
      title: 'Условия доставки — заполнить вместе',
      answers: L('Уточнить зоны, стоимость, интервалы и условия доставки в отель.', 'Confirm areas, fees, slots and hotel delivery rules.', 'ยืนยันพื้นที่ ราคา เวลา และเงื่อนไขจัดส่งโรงแรม'),
      keywords: 'достав,delivery,จัดส่ง',
      status: 'draft',
      updatedAt: now
    }]
  };
}
