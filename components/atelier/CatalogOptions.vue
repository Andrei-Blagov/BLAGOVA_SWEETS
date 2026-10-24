<script setup lang="ts">
import type { CatalogOption } from '~/data/atelier';
const props = defineProps<{ options: CatalogOption[]; modelValue: Record<string,string> }>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string,string>] }>();
const { t, local, money } = useAtelier();
const groups = computed(() => Object.entries(props.options.reduce<Record<string,CatalogOption[]>>((result, option) => {
  (result[option.optionGroup] ||= []).push(option);
  return result;
}, {})));
function choose(group: string, key: string) {
  emit('update:modelValue', { ...props.modelValue, [group]: key });
}
</script>
<template>
  <section v-if="options.length" class="catalog-option-list">
    <h3>{{ t('Дополнения', 'Extras', 'ตัวเลือกเพิ่มเติม') }}</h3>
    <fieldset v-for="([group, choices], index) in groups" :key="group" class="option-field">
      <legend>{{ t('Дополнение', 'Extra', 'ตัวเลือกเพิ่มเติม') }} {{ index + 1 }}</legend>
      <div class="choice-row wrap">
        <button type="button" :class="{selected:!modelValue[group]}" :aria-pressed="!modelValue[group]" @click="choose(group,'')">{{ t('Без дополнения','No extra','ไม่เพิ่ม') }}</button>
        <button v-for="option in choices" :key="option.optionKey" type="button" :class="{selected:modelValue[group]===option.optionKey}"
          :aria-pressed="modelValue[group]===option.optionKey" @click="choose(group,option.optionKey)">
          {{ local(option.label) }}<small v-if="option.priceDelta">+{{ money(option.priceDelta) }}</small>
        </button>
      </div>
    </fieldset>
  </section>
</template>
