<script setup lang="ts">
const props = defineProps<{ owner: boolean; date: string }>();
const api = () => useNuxtApp().$supabase;
type Counts = Record<string, number>;
interface Rules {
  budget: number; hold_minutes: number; coefficients: Counts; limits: Counts;
  gift_chocolates_per_set: number; gingerbread_per_set: number;
  slots: Array<{ weekday: number; start: string; end: string }>;
  blackouts: Array<{ date: string; reason: string }>;
}
interface Slot {
  label: string; used: number; capacity: number; available: boolean;
  category_used: Counts; category_limits: Counts; unknown_orders: number;
}
const names: Record<string, string> = {
  cake: 'Торты', chocolate: 'Наборы конфет', gingerbread: 'Комплекты пряников', small: 'Капкейки и трайфлы, шт.'
};
const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const slots = ref<Slot[]>([]);
const rules = ref<Rules | null>(null);
const version = ref(0);
const error = ref('');
const notice = ref('');
const busy = ref(false);
const loading = ref(true);
const week = computed(() => weekdays.map((name, i) => ({
  name, weekday: i + 1,
  slots: (rules.value?.slots || []).map((slot, index) => ({ slot, index })).filter(row => row.slot.weekday === i + 1)
})));
const percentage = (slot: Slot) => Math.min(100, Math.max(0, slot.used / Math.max(1, slot.capacity) * 100));
const slotHasRoom = (slot: Slot) => slot.available && !slot.unknown_orders && slot.used < slot.capacity;
const slotStatus = (slot: Slot) => slot.unknown_orders ? 'Нужна оценка' : slot.used >= slot.capacity ? 'Заполнен' : !slot.available ? 'Недоступен' : slot.used ? 'Есть место' : 'Свободен';
let request = 0;
async function load() {
  const id = ++request;
  error.value = ''; loading.value = true;
  try {
    const [day, settings] = await Promise.all([
      api().rpc('staff_production_day', { p_date: props.date }),
      api().from('production_rule_versions').select('version,config').order('version', { ascending: false }).limit(1).single()
    ]);
    if (id !== request) return;
    if (day.error || settings.error) throw new Error('load');
    slots.value = day.data as Slot[];
    rules.value = structuredClone(settings.data.config) as Rules;
    version.value = settings.data.version;
  } catch {
    if (id === request) { slots.value = []; error.value = 'Не удалось загрузить производственный календарь.'; }
  } finally {
    if (id === request) loading.value = false;
  }
}
async function save() {
  if (!rules.value || !props.owner || busy.value || loading.value) return;
  busy.value = true; notice.value = ''; error.value = '';
  try {
    const result = await api().rpc('save_production_rules', { p_config: rules.value, p_expected_version: version.value });
    if (result.error) throw result.error;
    await load(); notice.value = 'Сохранена новая версия правил. Нагрузка ранее подтверждённых заказов сохранена.';
  } catch {
    error.value = 'Правила не сохранены. Проверьте числа, пересечения интервалов и обновите данные.';
  } finally { busy.value = false; }
}
function revealInvalidField(event: Event) {
  let details = (event.target as Element).closest('details');
  while (details) { details.open = true; details = details.parentElement?.closest('details') || null; }
}
watch(() => props.date, load);
onMounted(load);
</script>

<template>
  <div class="production-workspace">
    <div class="production-heading">
      <div><h3>Нагрузка производства</h3><p>Занятость по всем заказам и действующим резервам</p></div>
      <button class="btn btn-outline" :disabled="loading || busy" @click="load">{{ loading ? 'Загружаем…' : 'Обновить нагрузку' }}</button>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="production-notice" role="status">{{ notice }}</p>
    <p v-if="loading" class="production-empty" role="status">Проверяем интервалы на выбранную дату…</p>
    <template v-else>
      <div v-if="slots.length" class="production-slots">
        <article v-for="slot in slots" :key="slot.label" :class="['production-slot', { 'production-slot-blocked': !slotHasRoom(slot) }]" :aria-label="`Нагрузка ${slot.label}`">
          <div class="production-slot-heading"><h4>{{ slot.label }}</h4><span class="production-status">{{ slotStatus(slot) }}</span></div>
          <div class="production-load"><strong>{{ slot.used }}<small> / {{ slot.capacity }}</small></strong><span>единиц занято</span></div>
          <div class="production-meter" role="progressbar" :aria-label="`Занятость ${slot.label}`" :aria-valuemin="0" :aria-valuemax="slot.capacity" :aria-valuenow="slot.used" :aria-valuetext="`${slot.used} из ${slot.capacity}`"><span :style="{ width: percentage(slot) + '%' }"></span></div>
          <p class="production-free">{{ slotHasRoom(slot) ? `Свободно ${Math.max(0, slot.capacity - slot.used)} ед.` : 'Новые бронирования недоступны' }}</p>
          <dl class="production-counts"><div v-for="(label, key) in names" :key="key"><dt>{{ label }}</dt><dd>{{ slot.category_used[key] || 0 }}<span> / {{ slot.category_limits[key] }}</span></dd></div></dl>
          <p v-if="slot.unknown_orders" class="production-warning">{{ slot.unknown_orders }} подтверждённых заказов с неизвестной нагрузкой. Сначала уточните их состав.</p>
        </article>
      </div>
      <p v-else-if="!error" class="production-empty">На эту дату нет рабочих интервалов. Проверьте расписание и недоступные даты.</p>
    </template>

    <details v-if="owner && rules" class="production-settings">
      <summary><span><strong>Настройки производства</strong><small>Вместимость, резерв, расписание и недоступные даты</small></span><span class="production-version">Версия {{ version }}</span></summary>
      <form class="production-settings-form" @submit.prevent="save" @invalid.capture="revealInvalidField">
        <fieldset :disabled="busy || loading">
          <legend>Вместимость и резерв</legend>
          <div class="production-fields">
            <label>Бюджет на интервал, ед.<input v-model.number="rules.budget" class="form-input" type="number" min="1" max="10000" required /></label>
            <label>Срок резерва, минут<input v-model.number="rules.hold_minutes" class="form-input" type="number" min="1" max="1440" required /></label>
          </div>
          <div class="production-category-table">
            <div class="production-category-head" aria-hidden="true"><span>Категория</span><span>Нагрузка за единицу</span><span>Предел на интервал</span></div>
            <div v-for="(label, key) in names" :key="key" class="production-category-row"><strong>{{ label }}</strong><label><span>Нагрузка: {{ label }}</span><input v-model.number="rules.coefficients[key]" class="form-input" type="number" min="1" max="10000" required /></label><label><span>Предел: {{ label }}</span><input v-model.number="rules.limits[key]" class="form-input" type="number" min="1" max="10000" required /></label></div>
          </div>
          <div class="production-fields">
            <label>Конфет в производственном наборе<input v-model.number="rules.gift_chocolates_per_set" class="form-input" type="number" min="1" max="10000" required /></label>
            <label>Пряников в производственном комплекте<input v-model.number="rules.gingerbread_per_set" class="form-input" type="number" min="1" max="10000" required /></label>
          </div>
        </fieldset>
        <fieldset :disabled="busy || loading">
          <legend>Рабочая неделя</legend>
          <p class="production-help">Откройте день, чтобы изменить интервалы. Время указано по Паттайе.</p>
          <div class="production-week">
            <details v-for="day in week" :key="day.weekday" class="production-day">
              <summary><strong>{{ day.name }}</strong><span>{{ day.slots.length ? day.slots.map(row => `${row.slot.start}–${row.slot.end}`).join(' · ') : 'Выходной' }}</span></summary>
              <div class="production-day-body">
                <div v-for="row in day.slots" :key="row.index" class="production-time-row">
                  <label>Начало<input v-model="row.slot.start" :aria-label="`Начало: ${day.name}, интервал ${row.index + 1}`" type="time" class="form-input" required /></label>
                  <label>Конец<input v-model="row.slot.end" :aria-label="`Конец: ${day.name}, интервал ${row.index + 1}`" type="time" class="form-input" required /></label>
                  <button type="button" class="production-remove" :aria-label="`Удалить интервал ${row.slot.start}–${row.slot.end}, ${day.name}`" @click="rules.slots.splice(row.index, 1)">Удалить</button>
                </div>
                <button type="button" class="text-link" @click="rules.slots.push({ weekday: day.weekday, start: '09:00', end: '12:00' })">Добавить интервал</button>
              </div>
            </details>
          </div>
        </fieldset>
        <fieldset :disabled="busy || loading">
          <legend>Недоступные даты</legend>
          <p v-if="!rules.blackouts.length" class="production-help">Дополнительных закрытых дат нет.</p>
          <div v-for="(blackout, i) in rules.blackouts" :key="i" class="production-blackout-row">
            <label>Дата<input v-model="blackout.date" type="date" class="form-input" required /></label>
            <label>Причина<input v-model="blackout.reason" maxlength="250" class="form-input" /></label>
            <button type="button" class="production-remove" :aria-label="`Удалить недоступную дату ${blackout.date}`" @click="rules.blackouts.splice(i, 1)">Удалить</button>
          </div>
          <button type="button" class="text-link" @click="rules.blackouts.push({ date, reason: '' })">Добавить дату</button>
        </fieldset>
        <div class="production-save"><p>Нагрузка сохранённых заказов не пересчитывается. При подтверждении и переносе проверяются текущие пределы.</p><button class="btn btn-dark" :disabled="busy || loading">{{ busy ? 'Сохраняем…' : 'Сохранить новую версию' }}</button></div>
      </form>
    </details>
  </div>
</template>
