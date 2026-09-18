<script setup lang="ts">
import { bangkokDate, statuses, transitions } from '~/data/operations';
import type { KnowledgeArticle, OrderStatus } from '~/data/operations';
import { L } from '~/data/atelier';
definePageMeta({
  layout: false
});
useHead({
  title: 'BLAGOVA · Демо-админка',
  htmlAttrs: {
    lang: 'ru'
  }
});
const {
  state,
  ready,
  storageWarning,
  thread,
  message,
  statusLabel,
  changeStatus,
  reschedule
} = useOperations();
const route = useRoute();
const tabs = [{
  id: 'orders',
  name: 'Заказы',
  icon: 'bag'
}, {
  id: 'conversations',
  name: 'Диалоги',
  icon: 'heart'
}, {
  id: 'calendar',
  name: 'Календарь',
  icon: 'clock'
}, {
  id: 'knowledge',
  name: 'Знания бота',
  icon: 'leaf'
}, {
  id: 'integrations',
  name: 'Интеграции',
  icon: 'diagonal'
}];
const tab = ref(tabs.some(t => t.id === route.query.tab) ? String(route.query.tab) : 'orders');
const search = ref('');
const filter = ref('all');
const selectedId = ref('');
const selected = computed(() => state.value.orders.find(o => o.id === selectedId.value));
const filtered = computed(() => state.value.orders.filter(o => (filter.value === 'all' || o.status === filter.value) && `${o.id} ${o.customer} ${o.items.map(i => i.name).join(' ')}`.toLowerCase().includes(search.value.trim().toLowerCase())));
const pending = computed(() => state.value.orders.filter(o => o.status === 'pending').length);
const production = computed(() => state.value.orders.filter(o => ['confirmed', 'production'].includes(o.status)).length);
const scheduled = computed(() => state.value.orders.filter(o => !['completed', 'cancelled'].includes(o.status)));
const calendarDate = ref(bangkokDate());
const calendarOrders = computed(() => scheduled.value.filter(o => o.date === calendarDate.value).sort((a, b) => a.slot.localeCompare(b.slot)));
const week = computed(() => Array.from({
  length: 7
}, (_, i) => ({
  date: bangkokDate(i),
  count: scheduled.value.filter(o => o.date === bangkokDate(i)).length
})));
const moveDate = ref('');
const moveSlot = ref('');
const notice = ref('');
const managerReply = ref('');
const editing = ref<KnowledgeArticle>();
const knowledgeError = ref('');
const money = (n: number) => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0
}).format(n);
const day = (s: string) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Bangkok'
}).format(new Date(s + 'T12:00:00+07:00'));
const time = (s: string) => new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Bangkok'
}).format(new Date(s));
watch(selected, o => {
  moveDate.value = o?.date || '';
  moveSlot.value = o?.slot || '10:00–12:00';
  notice.value = '';
});
function openOrder(id: string) {
  selectedId.value = id;
  tab.value = 'orders';
}
function moveOrder() {
  if (!selected.value) return;
  notice.value = reschedule(selected.value.id, moveDate.value, moveSlot.value) ? 'Дата обновлена в демо-календаре. Google Calendar не подключён.' : 'Выберите корректную дату. Завершённые заказы не переносятся.';
}
function sendManager() {
  if (!managerReply.value.trim() || thread.value.mode !== 'manager') return;
  message('manager', managerReply.value);
  managerReply.value = '';
}
function editKnowledge(article?: KnowledgeArticle) {
  editing.value = article ? {
    ...article,
    answers: {
      ...article.answers
    }
  } : {
    id: demoId(),
    title: '',
    answers: L('', '', ''),
    keywords: '',
    status: 'draft',
    updatedAt: new Date().toISOString()
  };
  knowledgeError.value = '';
}
function saveKnowledge(publish: boolean) {
  const k = editing.value;
  if (!k) return;
  if (!k.title.trim() || !k.answers.ru.trim() || publish && (!k.answers.en.trim() || !k.answers.th.trim() || !k.keywords.split(',').some(w => w.trim()))) {
    knowledgeError.value = 'Укажите заголовок и русский текст. Для публикации заполните все три языка и ключевые слова.';
    return;
  }
  const value: KnowledgeArticle = {
    ...k,
    title: k.title.trim(),
    answers: {
      ...k.answers
    },
    status: publish ? 'published' : 'draft',
    updatedAt: new Date().toISOString()
  };
  const index = state.value.knowledge.findIndex(a => a.id === k.id);
  if (index < 0) state.value.knowledge.push(value);else state.value.knowledge[index] = value;
  editing.value = undefined;
  notice.value = publish ? 'Материал опубликован для демо-помощника. Векторная индексация не подключена.' : 'Черновик сохранён. Помощник его не использует.';
}
</script>
<template>
  <div class="studio">
    <aside class="studio-sidebar">
<NuxtLink to="/" class="wordmark">BLAGOVA<span>ATELIER · WORKSPACE</span>
</NuxtLink>
<div class="studio-location">
<span class="studio-dot">
</span>Pattaya, Thailand <small>DEMO</small>
</div>
<nav aria-label="Разделы админки">
<button v-for="item in tabs" :key="item.id" :class="{active:tab===item.id}" :aria-current="tab===item.id ? 'page' : undefined" @click="tab=item.id; notice=''">
      <AtelierIcon :name="item.icon" :size="19"/>
<span>{{ item.name }}</span>
<span v-if="item.id==='orders' && pending" class="studio-nav-count">{{ pending }}</span>
<span v-if="item.id==='conversations' && thread.mode==='requested'" class="studio-nav-count">1</span>
    </button>
</nav>
<div class="studio-sidebar-bottom">
<p>Маленькие детали.<br>Большая забота.</p>
<NuxtLink to="/">← Вернуться на сайт</NuxtLink>
</div>
</aside>
    <main class="studio-main">
<header class="studio-topbar">
<span>BLAGOVA / {{ tabs.find(t=>t.id===tab)?.name }}</span>
<div>
<span class="studio-timezone">Asia/Bangkok</span>
<span class="studio-user">B</span>
</div>
</header>
      <div class="studio-content">
<div class="studio-intro">
<div>
<span class="eyebrow">YOUR LITTLE BUSINESS, BEAUTIFULLY ORGANISED</span>
<h1>{{ tab==='orders' ? 'Всё под контролем.' : tab==='conversations' ? 'Ближе к каждому.' : tab==='calendar' ? 'Ритм вашей недели.' : tab==='knowledge' ? 'Знания с заботой.' : 'Всё на своих местах.' }}</h1>
<p>{{ tab==='orders' ? 'Каждый заказ — чья-то маленькая радость.' : tab==='knowledge' ? 'Только проверенная информация становится ответом помощника.' : 'Рабочее пространство будущей кондитерской.' }}</p>
</div>
<span class="studio-demo-pill">ДЕМО-РЕЖИМ</span>
</div>
      <div class="studio-banner">
<AtelierIcon name="leaf" :size="20"/>
<p>
<strong>Можно попробовать весь процесс.</strong> Данные сохраняются только в этом браузере. Используйте вымышленные контакты. LINE, Google Calendar, AI/RAG и вход сотрудников ещё не подключены.</p>
</div>
      <p v-if="storageWarning" class="form-error" role="alert">Сохранение в браузере недоступно или сохранённые данные повреждены. Изменения могут не пережить перезагрузку.</p>
      <p v-if="!ready" class="empty-state">Загружаем демо-пространство…</p>
      <template v-else>
      <template v-if="tab==='orders'">
        <div class="studio-stats">
<article>
<span>Ждут внимания</span>
<strong>{{ pending }}</strong>
<small>Новые заявки на проверке</small>
</article>
<article>
<span>Готовим с любовью</span>
<strong>{{ production }}</strong>
<small>Подтверждены или в работе</small>
</article>
<article>
<span>Готовы к встрече</span>
<strong>{{ state.orders.filter(o=>o.status==='ready').length }}</strong>
<small>Можно выдать покупателю</small>
</article>
<article>
<span>В расписании</span>
<strong>{{ scheduled.length }}</strong>
<small>Локальный демо-календарь</small>
</article>
</div>
        <div class="studio-orders-layout">
<section class="studio-card">
<div class="studio-card-heading">
<h2>Заказы <span>{{ state.orders.length }}</span>
</h2>
<NuxtLink to="/">Создать на сайте ↗</NuxtLink>
</div>
<div class="studio-filters">
<label class="studio-search">
<AtelierIcon name="search" :size="18"/>
<input v-model="search" aria-label="Поиск заказов" placeholder="Имя, номер или десерт"/>
</label>
<select v-model="filter" aria-label="Статус заказа">
<option value="all">Все статусы</option>
<option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.label }}</option>
</select>
</div>
        <div class="studio-order-list">
<button v-for="o in filtered" :key="o.id" :class="['studio-order-row',{selected:selectedId===o.id}]" @click="selectedId=o.id">
<div>
<small>{{ o.id }} · {{ o.source==='chat' ? 'Чат' : 'Сайт' }}</small>
<strong>{{ o.customer }}</strong>
<span>{{ o.items.map(i=>i.name+' × '+i.quantity).join(', ') }}</span>
</div>
<div class="studio-order-meta">
<span :class="['status-chip','status-'+o.status]">{{ statusLabel(o.status) }}</span>
<strong>{{ money(o.total) }}</strong>
<small>{{ day(o.date) }} · {{ o.slot }}</small>
</div>
</button>
<p v-if="!filtered.length" class="studio-empty">Ничего не найдено. Измените поиск или статус.</p>
</div>
</section>
        <aside class="studio-card order-inspector">
<template v-if="selected">
<div class="studio-card-heading">
<h2>Детали</h2>
<button class="icon-button" aria-label="Закрыть детали" @click="selectedId='' ">
<AtelierIcon name="close" :size="18"/>
</button>
</div>
<span class="eyebrow">{{ selected.id }}</span>
<h3>{{ selected.customer }}</h3>
<p>{{ selected.contact }}</p>
<div class="inspector-section">
<span :class="['status-chip','status-'+selected.status]">{{ statusLabel(selected.status) }}</span>
<p>{{ selected.mode==='delivery' ? 'Доставка · '+selected.address : 'Самовывоз' }}</p>
<p>{{ selected.note || 'Без дополнительных пожеланий' }}</p>
</div>
<div class="inspector-item" v-for="(item,i) in selected.items" :key="i">
<span>{{ item.name }} × {{ item.quantity }}<small>{{ item.detail }}</small>
</span>
<strong>{{ money(item.price*item.quantity) }}</strong>
</div>
<div class="inspector-item">
<span>Доставка</span>
<strong>{{ money(selected.delivery) }}</strong>
</div>
<div class="inspector-total">
<span>Итого</span>
<strong>{{ money(selected.total) }}</strong>
</div>
<div class="inspector-actions">
<button v-for="s in transitions[selected.status]" :key="s" :class="['btn',s==='cancelled'?'btn-outline':'btn-dark']" @click="changeStatus(selected.id,s)">{{ s==='confirmed'?'Подтвердить заявку':s==='production'?'Взять в работу':s==='ready'?'Готов к выдаче':s==='completed'?'Завершить':'Отменить заказ' }}</button>
</div>
<form v-if="!['completed','cancelled'].includes(selected.status)" class="inspector-section" @submit.prevent="moveOrder">
<label>Перенести на дату<input v-model="moveDate" type="date" :min="bangkokDate()" class="form-input" required />
</label>
<label>Интервал<select v-model="moveSlot" class="form-input">
<option>10:00–12:00</option>
<option>12:00–15:00</option>
<option>15:00–18:00</option>
</select>
</label>
<button class="text-link">Сохранить дату →</button>
</form>
<p v-if="notice" class="studio-notice" role="status">{{ notice }}</p>
<div class="inspector-history">
<h4>История</h4>
<p v-for="(h,i) in selected.history" :key="i">
<small>{{ time(h.at) }}</small>{{ h.text }}</p>
</div>
</template>
<div v-else class="inspector-placeholder">
<AtelierIcon name="bag" :size="32"/>
<h3>История одного заказа</h3>
<p>Выберите заявку, чтобы посмотреть состав, изменить статус или перенести дату.</p>
</div>
</aside>
</div>
      </template>
      <section v-if="tab==='conversations'" class="studio-card conversations-workspace">
<aside class="conversation-list">
<span class="eyebrow">САЙТ · ДЕМО-ДИАЛОГ</span>
<h3>{{ thread.name }}</h3>
<p>{{ thread.messages.length }} сообщений</p>
<span class="status-chip">{{ thread.mode==='bot'?'Отвечает помощник':thread.mode==='requested'?'Запрошен менеджер':'Менеджер в диалоге' }}</span>
<p>Попробуйте чат на витрине, затем вернитесь сюда. История общая в пределах этого браузера.</p>
<NuxtLink class="text-link" to="/">Открыть витрину ↗</NuxtLink>
<p class="demo-note">Переписка LINE появится здесь после подключения Official Account.</p>
</aside>
<div class="manager-workspace">
<div class="manager-toolbar">
<strong>{{ thread.mode==='bot'?'Помощник активен':'Помощник на паузе' }}</strong>
<button v-if="thread.mode!=='manager'" class="btn btn-dark" @click="thread.mode='manager'">Принять диалог</button>
<button v-else class="btn btn-outline" @click="thread.mode='bot'">Вернуть боту</button>
</div>
<div class="manager-log" role="log" aria-live="polite">
<p v-if="!thread.messages.length" class="studio-empty">Пока нет сообщений. Начните разговор в чате сайта.</p>
<article v-for="m in thread.messages" :key="m.id" :class="['chat-bubble','chat-'+m.role]">
<small>{{ m.role==='customer'?'Посетитель':m.role==='manager'?'Менеджер · демо':'Помощник · демо' }} · {{ time(m.at) }}</small>
<p>{{ m.text }}</p>
<span v-if="m.source" class="chat-source">Источник: {{ m.source }}</span>
</article>
</div>
<form class="manager-compose" @submit.prevent="sendManager">
<label for="manager-reply">Ответ менеджера · только демо-чат</label>
<textarea id="manager-reply" v-model="managerReply" :disabled="thread.mode!=='manager'" placeholder="Примите диалог, чтобы ответить" maxlength="2000" rows="3" class="form-input">
</textarea>
<button class="btn btn-dark" :disabled="thread.mode!=='manager' || !managerReply.trim()">Отправить в демо-чат <AtelierIcon name="arrow"/>
</button>
</form>
</div>
</section>
      <section v-if="tab==='calendar'" class="studio-card calendar-workspace">
<div class="studio-card-heading">
<div>
<h2>Ближайшие семь дней</h2>
<p>Выдача и доставка · время Паттайи</p>
</div>
<span class="integration-off">Google не подключён</span>
</div>
<div class="studio-week">
<button v-for="d in week" :key="d.date" :class="{selected:calendarDate===d.date}" @click="calendarDate=d.date">
<span>{{ day(d.date) }}</span>
<strong>{{ d.count }}</strong>
<small>заявок</small>
</button>
</div>
<label class="calendar-date-label">Посмотреть другую дату<input v-model="calendarDate" type="date" class="form-input" />
</label>
<div class="calendar-events">
<p v-if="!calendarOrders.length" class="studio-empty">На эту дату нет активных демо-заявок.</p>
<button v-for="o in calendarOrders" :key="o.id" class="calendar-event" @click="openOrder(o.id)">
<span>{{ o.slot }}<small>{{ o.mode==='delivery'?'Доставка':'Самовывоз' }}</small>
</span>
<div>
<strong>{{ o.customer }}</strong>
<p>{{ o.items.map(i=>i.name).join(', ') }}</p>
<small>{{ o.id }}</small>
</div>
<span :class="['status-chip','status-'+o.status]">{{ statusLabel(o.status) }}</span>
<AtelierIcon name="arrow" :size="20"/>
</button>
</div>
<p class="demo-note">Заявки «На проверке» показаны отдельно от подтверждённых. Отменённые и завершённые исключены. Изменение даты заказа сразу обновляет этот календарь.</p>
</section>
      <section v-if="tab==='knowledge'" class="knowledge-workspace">
<div class="studio-card">
<div class="studio-card-heading">
<h2>Материалы помощника</h2>
<button class="btn btn-dark" @click="editKnowledge()">Добавить материал +</button>
</div>
<p class="knowledge-explanation">Сейчас работает поиск по ключевым словам в опубликованных материалах. AI и векторный RAG не подключены. Черновики не используются в ответах.</p>
<p v-if="notice" class="studio-notice" role="status">{{ notice }}</p>
<button v-for="k in state.knowledge" :key="k.id" class="knowledge-row" @click="editKnowledge(k)">
<AtelierIcon name="leaf" :size="20"/>
<div>
<strong>{{ k.title }}</strong>
<p>{{ k.answers.ru }}</p>
</div>
<span :class="['status-chip',k.status==='published'?'status-confirmed':'status-pending']">{{ k.status==='published'?'Опубликован':'Черновик' }}</span>
<AtelierIcon name="diagonal" :size="18"/>
</button>
</div>
<form v-if="editing" class="studio-card knowledge-editor" @submit.prevent="saveKnowledge(false)">
<div class="studio-card-heading">
<h2>Редактор материала</h2>
<button type="button" class="icon-button" aria-label="Закрыть редактор" @click="editing=undefined">
<AtelierIcon name="close"/>
</button>
</div>
<label>Название<input v-model="editing.title" class="form-input" maxlength="120" required/>
</label>
<label>Ответ на русском<textarea v-model="editing.answers.ru" class="form-input" rows="4" maxlength="2000" required>
</textarea>
</label>
<label>Answer in English<textarea v-model="editing.answers.en" class="form-input" rows="3" maxlength="2000">
</textarea>
</label>
<label>คำตอบภาษาไทย<textarea v-model="editing.answers.th" class="form-input" rows="3" maxlength="2000">
</textarea>
</label>
<label>Ключевые слова через запятую<input v-model="editing.keywords" class="form-input" maxlength="500" placeholder="адрес,location,ที่อยู่" />
</label>
<p class="demo-note">Публикация означает, что вы проверили текст для демо. Цены и сроки из прототипа не являются утверждёнными условиями бизнеса.</p>
<p v-if="knowledgeError" class="form-error" role="alert">{{ knowledgeError }}</p>
<div class="button-row">
<button class="btn btn-outline">Сохранить черновик</button>
<button type="button" class="btn btn-dark" @click="saveKnowledge(true)">Опубликовать для демо</button>
</div>
</form>
</section>
      <section v-if="tab==='integrations'">
<div class="integration-grid">
<article v-for="integration in [{name:'Supabase',text:'Заказы, сообщения, авторизация сотрудников и знания. Для подключения нужна повторная авторизация и выбор проекта.',icon:'bag'},{name:'LINE Official Account',text:'Переписка, уведомления и передача менеджеру. Нужны аккаунт, серверный webhook и настройка доступа.',icon:'heart'},{name:'Google Calendar',text:'Синхронизация выдачи, переносов и отмен. Нужен отдельный календарь и серверное подключение.',icon:'clock'},{name:'AI + RAG',text:'Ответы по проверенным материалам. Нужны модель, серверный доступ и векторная индексация утверждённых знаний.',icon:'leaf'}]" :key="integration.name" class="studio-card integration-card">
<AtelierIcon :name="integration.icon" :size="28"/>
<span class="integration-off">Не подключено</span>
<h2>{{ integration.name }}</h2>
<p>{{ integration.text }}</p>
</article>
</div>
<div class="studio-card integration-next">
<span class="eyebrow">СЛЕДУЮЩИЙ ЭТАП</span>
<h2>От сценария — к реальным заказам.</h2>
<p>Интерфейсы и локальный процесс готовы для проверки. Для рабочего запуска подключим серверную запись, вход сотрудников, права доступа и синхронизацию с защитой от дублей. Ключи API не вводятся в этот прототип.</p>
<div class="integration-flow">
<span>Заявка</span>
<AtelierIcon name="arrow"/>
<span>База заказов</span>
<AtelierIcon name="arrow"/>
<span>Календарь и LINE</span>
</div>
</div>
</section>
      </template>
      <footer class="studio-footer">
<span>BLAGOVA SWEETS · Рабочее пространство</span>
<span>Локальный прототип · реальные заказы не принимаются</span>
</footer>
</div>
    </main>
  </div>
</template>
