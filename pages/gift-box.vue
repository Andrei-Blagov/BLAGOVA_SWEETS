<script setup lang="ts">
const { rules, builders, load: loadCatalog, error: catalogError } = useCatalog();
onMounted(() => loadCatalog());
const builder = computed(() => builders.value['custom-gift']);
const ready = computed(() => Boolean(builder.value?.sku && ['gift_box_base','gift_chocolate','gift_raspberry','gift_pistachio','gift_gingerbread'].every(key => Number.isFinite(rules.value[key]))));
const {
  t,
  money,
  add
} = useAtelier();
const size = ref(6);
const selected = reactive({
  chocolate: 0,
  raspberry: 0,
  pistachio: 0,
  gingerbread: 0
});
const flavours = computed(() => [{
  id: 'chocolate' as const,
  label: t('Тёмный шоколад', 'Dark chocolate', 'ดาร์กช็อกโกแลต'),
  color: '#553b30',
  price: rules.value.gift_chocolate || 0
}, {
  id: 'raspberry' as const,
  label: t('Малина', 'Raspberry', 'ราสป์เบอร์รี'),
  color: '#ac5d68',
  price: rules.value.gift_raspberry || 0
}, {
  id: 'pistachio' as const,
  label: t('Фисташка', 'Pistachio', 'พิสตาชิโอ'),
  color: '#a3a778',
  price: rules.value.gift_pistachio || 0
}, {
  id: 'gingerbread' as const,
  label: t('Имбирный пряник', 'Gingerbread heart', 'ขนมปังขิงรูปหัวใจ'),
  color: '#d6b08c',
  price: rules.value.gift_gingerbread || 0
}]);
const count = computed(() => Object.values(selected).reduce((a, b) => a + b, 0));
const price = computed(() => (rules.value.gift_box_base || 0) + flavours.value.reduce((sum, f) => sum + selected[f.id] * f.price, 0));
const slots = computed(() => flavours.value.flatMap(f => Array.from({
  length: selected[f.id]
}, () => f)));
const ribbon = ref('wine');
const note = ref('');
function setSize(n: number) {
  size.value = n;
  if (count.value > n) Object.keys(selected).forEach(k => {
    selected[k as keyof typeof selected] = 0;
  });
}
function change(id: keyof typeof selected, delta: number) {
  if (delta > 0 && count.value >= size.value || selected[id] + delta < 0) return;
  selected[id] += delta;
}
function addGift() {
  if (count.value !== size.value || !ready.value || !builder.value) return;
  const detail = flavours.value.filter(f => selected[f.id]).map(f => `${f.label} × ${selected[f.id]}`).join(', ') + (note.value.trim() ? ` · ${note.value.trim()}` : '') + ` · ${t('Лента', 'Ribbon', 'ริบบิ้น')}: ${ribbon.value === 'wine' ? t('бордовая', 'wine', 'สีไวน์') : t('оливковая', 'olive', 'สีมะกอก')}`;
  add({
    key: JSON.stringify(['gift', size.value, selected, ribbon.value, note.value.trim()]),
    productId: 'custom-gift',
    sku: builder.value.sku,
    name: builder.value.name,
    image: builder.value.image,
    price: price.value,
    detail,
    personalization: note.value.trim(),
    configuration: { size: size.value, chocolate: selected.chocolate, raspberry: selected.raspberry, pistachio: selected.pistachio, gingerbread: selected.gingerbread, ribbon: ribbon.value },
    leadDays: builder.value.leadDays
  });
}
</script>
<template>
  <section class="shell section">
    <div class="page-intro">
      <span class="eyebrow">A LITTLE BOX OF LOVE</span>
      <h1>{{ t('Подарок,','A gift,','ของขวัญ') }} <em>{{ t('который про вас.','your way.','ในแบบคุณ') }}</em>
      </h1>
      <p>{{ t('Соберите любимые вкусы. Выберите ленту. Добавьте несколько тёплых слов.','Pick your favourite flavours. Choose a ribbon. Add a few heartfelt words.','เลือกรสชาติที่ชอบ เลือกริบบิ้น และเพิ่มข้อความจากใจ') }}</p>
    </div>
    <p v-if="catalogError" role="alert">{{ catalogError }}</p>
    <div class="builder-grid">
      <div class="box-preview">
        <div class="preview-head">
          <span class="eyebrow">YOUR LITTLE BOX</span>
          <span>{{ count }} / {{ size }}</span>
        </div>
        <div class="visual-box" :class="'ribbon-'+ribbon">
          <div class="box-lid">BLAGOVA<span>MADE WITH A LITTLE LOVE</span>
          </div>
          <div class="box-slots" :class="{'large-box':size===9}">
            <div v-for="i in size" :key="i" class="box-slot">
              <span v-if="slots[i-1]" class="bonbon" :class="slots[i-1]?.id" :style="{'--bonbon-color':slots[i-1]?.color}">
              </span>
              <span v-else class="empty-slot-number">{{ String(i).padStart(2,'0') }}</span>
            </div>
          </div>
          <div class="box-ribbon">
          </div>
        </div>
        <div class="gift-card-preview">
          <span>WITH LOVE,</span>
          <p>{{ note || t('Здесь будут ваши тёплые слова','Your heartfelt words go here','ข้อความจากใจของคุณ') }}</p>
        </div>
        <p class="demo-note">{{ t('Схематичный предпросмотр набора. Итоговое оформление согласовывается отдельно.','A schematic preview. Final presentation is agreed separately.','ภาพตัวอย่างแบบจำลอง การตกแต่งจริงต้องยืนยันแยกต่างหาก') }}</p>
      </div>
      <div class="builder-controls">
        <fieldset class="option-field">
          <legend>
            <span class="step-number">01</span>{{ t('Размер коробки','Choose a box','เลือกขนาดกล่อง') }}</legend>
          <div class="choice-row">
            <button v-for="n in [6,9]" :key="n" :class="{selected:size===n}" :aria-pressed="size===n" @click="setSize(n)">{{ n }} {{ t('сладостей','little treats','ชิ้น') }}<small>{{ n===6 ? t('Маленький комплимент','A little something','ของขวัญเล็ก ๆ') : t('Большое спасибо','A bigger thank you','คำขอบคุณที่ยิ่งใหญ่') }}</small>
            </button>
          </div>
        </fieldset>
        <fieldset class="option-field">
          <legend>
            <span class="step-number">02</span>{{ t('Наполните вкусами','Fill it with flavours','เลือกรสชาติ') }}</legend>
          <div v-for="f in flavours" :key="f.id" class="flavour-row">
            <span class="flavour-dot" :style="{background:f.color}">
            </span>
            <div>
              <strong>{{ f.label }}</strong>
              <small>{{ money(f.price) }} / {{ t('шт.','piece','ชิ้น') }}</small>
            </div>
            <div class="quantity-control">
              <button :disabled="!selected[f.id]" :aria-label="t('Убрать','Remove','ลด')+' '+f.label" @click="change(f.id,-1)">−</button>
              <span>{{ selected[f.id] }}</span>
              <button :disabled="count>=size" :aria-label="t('Добавить','Add','เพิ่ม')+' '+f.label" @click="change(f.id,1)">+</button>
            </div>
          </div>
        </fieldset>
        <fieldset class="option-field">
          <legend>
            <span class="step-number">03</span>{{ t('Последний штрих','Make it personal','เพิ่มความพิเศษ') }}</legend>
          <div class="ribbon-choices">
            <button :class="{selected:ribbon==='wine'}" :aria-pressed="ribbon==='wine'" @click="ribbon='wine'">
              <i style="background:#803e4b">
              </i>{{ t('Бордовая лента','Wine ribbon','ริบบิ้นสีไวน์') }}</button>
            <button :class="{selected:ribbon==='olive'}" :aria-pressed="ribbon==='olive'" @click="ribbon='olive'">
              <i style="background:#858767">
              </i>{{ t('Оливковая лента','Olive ribbon','ริบบิ้นสีมะกอก') }}</button>
          </div>
          <label class="field-label" for="gift-note">{{ t('Текст открытки','Your gift message','ข้อความในการ์ด') }}</label>
          <textarea id="gift-note" v-model="note" class="form-input" maxlength="120" rows="2" :placeholder="t('Напишите что-нибудь от сердца…','Something from the heart…','ข้อความจากใจ…')">
          </textarea>
          <div class="input-meta">{{ note.length }}/120</div>
        </fieldset>
        <div class="builder-total">
          <span>{{ t('Ваш набор','Your gift box','กล่องของคุณ') }}<small>{{ t('Упаковка и открытка','Box & gift card','กล่องและการ์ด') + ': ' + money(rules.gift_box_base || 0) }}</small>
          </span>
          <strong>{{ money(price) }}</strong>
        </div>
        <button class="btn btn-dark full-width" :disabled="count!==size || !ready" @click="addGift">{{ count===size ? t('Добавить подарок в корзину','Add gift to bag','เพิ่มของขวัญลงตะกร้า') : t('Осталось выбрать','Choose another','เลือกเพิ่มอีก')+' '+(size-count) }}<AtelierIcon name="gift" />
        </button>
        <p class="demo-note">{{ t('Тестовый конструктор. Все цены демонстрационные.','Demo builder. All prices are illustrative.','ตัวสร้างกล่องสาธิต ราคาทั้งหมดเป็นตัวอย่าง') }}</p>
      </div>
    </div>
  </section>
</template>
