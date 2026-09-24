<script setup lang="ts">
import type { CatalogOption } from '~/data/atelier';
import { optionConfiguration, optionTotal, selectedOptions } from '~/utils/catalogOptions.mjs';
const { rules, builders, load: loadCatalog, error: catalogError } = useCatalog();
onMounted(() => loadCatalog());
const builder = computed(() => builders.value['celebration-set']);
const ready = computed(() => Boolean(builder.value?.sku && ['celebration_cake_kg','celebration_cupcake','celebration_cookie'].every(key => Number.isFinite(rules.value[key]))));
const {
  t,
  money,
  local,
  add
} = useAtelier();
const guests = ref(8);
const occasion = ref('birthday');
const withCupcakes = ref(true);
const withCookies = ref(true);
const inscription = ref('');
const chosenOptions = ref<Record<string,string>>({});
const cakeKg = computed(() => Math.ceil(guests.value / 7 * 2) / 2);
const total = computed(() => cakeKg.value * (rules.value.celebration_cake_kg || 0) + (withCupcakes.value ? guests.value * (rules.value.celebration_cupcake || 0) : 0) + (withCookies.value ? guests.value * (rules.value.celebration_cookie || 0) : 0));
const totalWithOptions = computed(() => total.value + optionTotal(builder.value?.options,chosenOptions.value));
const occasions = computed(() => [{
  id: 'birthday',
  name: t('День рождения', 'Birthday', 'วันเกิด')
}, {
  id: 'children',
  name: t('Детский праздник', 'Kids’ party', 'งานเลี้ยงเด็ก')
}, {
  id: 'anniversary',
  name: t('Годовщина', 'Anniversary', 'วันครบรอบ')
}]);
function addSet() {
  if (!ready.value || !builder.value) return;
  const options = optionConfiguration(chosenOptions.value);
  add({
    key: JSON.stringify(['party', guests.value, occasion.value, withCupcakes.value, withCookies.value, options, inscription.value.trim()]),
    productId: 'celebration-set',
    sku: builder.value.sku,
    name: builder.value.name,
    image: builder.value.image,
    price: totalWithOptions.value,
    leadDays: builder.value.leadDays,
    detail: `${occasions.value.find(o => o.id === occasion.value)?.name} · ${guests.value} ${t('гостей', 'guests', 'คน')} · ${cakeKg.value} ${t('кг торта', 'kg cake', 'กก. เค้ก')}${withCupcakes.value ? ' + ' + guests.value + ' ' + t('капкейков', 'cupcakes', 'คัพเค้ก') : ''}${withCookies.value ? ' + ' + guests.value + ' ' + t('пряников', 'cookies', 'คุกกี้') : ''}${inscription.value.trim() ? ' · ' + inscription.value.trim() : ''}${selectedOptions(builder.value.options,options).map((o: CatalogOption) => ' · ' + local(o.label)).join('')}`,
    personalization: inscription.value.trim(),
    configuration: { guests: guests.value, occasion: occasion.value, withCupcakes: withCupcakes.value, withCookies: withCookies.value, options }
  });
}
</script>
<template>
  <section class="shell section">
    <div class="page-intro">
      <span class="eyebrow">LET’S CELEBRATE</span>
      <h1>{{ t('Ваш день.','Your day.','วันของคุณ') }} <em>{{ t('Ваша сладкая история.','Your sweet story.','เรื่องราวแสนหวานของคุณ') }}</em>
      </h1>
      <p>{{ t('Соберите десерты на свой праздник. Один стиль, любимые вкусы и что-то вкусное для каждого гостя.','Build your celebration around something sweet. One theme, favourite flavours and a little treat for every guest.','จัดขนมสำหรับงานฉลอง ในธีมเดียวกัน รสชาติที่ชอบ และขนมสำหรับแขกทุกคน') }}</p>
    </div>
    <p v-if="catalogError" role="alert">{{ catalogError }}</p>
    <div class="builder-grid">
      <div class="party-visual">
        <img src="/prototype/cake.webp" :alt="t('Пример праздничного торта','Celebration cake concept','แนวคิดเค้กงานฉลอง')" width="1000" height="850" />
        <div class="party-caption">
          <span class="eyebrow">YOUR CELEBRATION RECIPE</span>
          <h3>{{ guests }} {{ t('гостей. Один счастливый день.','guests. One happy day.','คน หนึ่งวันแห่งความสุข') }}</h3>
          <p>{{ t('Визуальный пример. Окончательный декор согласовывается с кондитером.','A visual example. Final decoration is agreed with the pastry chef.','ภาพตัวอย่าง การตกแต่งจริงต้องยืนยันกับเชฟ') }}</p>
        </div>
      </div>
      <div class="builder-controls">
        <fieldset class="option-field">
          <legend>{{ t('Какой повод?','What’s the occasion?','โอกาสอะไร?') }}</legend>
          <div class="choice-row wrap">
            <button v-for="o in occasions" :key="o.id" :class="{selected:occasion===o.id}" :aria-pressed="occasion===o.id" @click="occasion=o.id">{{ o.name }}</button>
          </div>
        </fieldset>
        <label class="field-label" for="guest-count">{{ t('Сколько гостей?','How many guests?','แขกกี่คน?') }}<strong>{{ guests }}</strong>
        </label>
        <input id="guest-count" v-model.number="guests" type="range" min="4" max="30" step="1" />
        <div class="range-labels">
          <span>4</span>
          <span>30</span>
        </div>
        <div class="party-cake-line">
          <AtelierIcon name="heart" />
          <div>
            <strong>{{ t('Ягодное облако','Berry cloud cake','เค้กเบอร์รีคลาวด์') }}</strong>
            <small>{{ cakeKg }} {{ t('кг · ориентир 6–8 порций на кг','kg · approx. 6–8 servings per kg','กก. · ประมาณ 6–8 ที่ต่อ กก.') }}</small>
          </div>
          <span>{{ money(cakeKg*(rules.celebration_cake_kg || 0)) }}</span>
        </div>
        <label class="check-card">
          <input v-model="withCupcakes" type="checkbox" />
          <span>
            <strong>{{ t('Капкейк каждому гостю','A cupcake for every guest','คัพเค้กสำหรับแขกทุกคน') }}</strong>
            <small>{{ guests }} {{ t('шт.','pieces','ชิ้น') }}</small>
          </span>
          <span>{{ money(guests*(rules.celebration_cupcake || 0)) }}</span>
        </label>
        <label class="check-card">
          <input v-model="withCookies" type="checkbox" />
          <span>
            <strong>{{ t('Именные пряники','Personalised gingerbread','ขนมปังขิงพร้อมชื่อ') }}</strong>
            <small>{{ t('Маленький подарок с собой','A little gift to take home','ของขวัญเล็ก ๆ กลับบ้าน') }}</small>
          </span>
          <span>{{ money(guests*(rules.celebration_cookie || 0)) }}</span>
        </label>
        <label class="field-label" for="party-message">{{ t('Надпись на торте','Cake message','ข้อความบนเค้ก') }}</label>
        <input id="party-message" v-model="inscription" class="form-input" maxlength="40" :placeholder="t('Например: Анне 5!','For example: Anna is 5!','เช่น แอนนา 5 ขวบ!')" />
        <AtelierCatalogOptions v-if="builder?.options.length" v-model="chosenOptions" :options="builder.options" />
        <div class="builder-total">
          <span>{{ t('Примерная стоимость','Illustrative total','ราคารวมตัวอย่าง') }}</span>
          <strong>{{ money(totalWithOptions) }}</strong>
        </div>
        <button class="btn btn-dark full-width" :disabled="!ready" @click="addSet">{{ t('Сохранить комплект в корзину','Add celebration to bag','เพิ่มชุดลงตะกร้า') }}<AtelierIcon name="arrow" />
        </button>
        <p class="demo-note">{{ t('Демонстрационный расчёт без индивидуального сложного декора. Окончательные условия появятся после запуска.','Demo pricing excludes complex custom decoration. Final terms will be available at launch.','ราคาสาธิตไม่รวมการตกแต่งพิเศษ เงื่อนไขจริงจะแจ้งเมื่อเปิดร้าน') }}</p>
      </div>
    </div>
  </section>
</template>
