<script setup lang="ts">
definePageMeta({ layout: false });
useHead({ title: 'Восстановление пароля · BLAGOVA SWEETS', htmlAttrs: { lang: 'ru' } });
const email = ref('');
const busy = ref(false);
const sent = ref(false);
const error = ref('');

async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const { error: authError } = await useNuxtApp().$supabase.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (authError) throw authError;
    sent.value = true;
  } catch {
    error.value = 'Не удалось отправить письмо. Повторите позже.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="staff-login">
    <section class="staff-login-story">
      <NuxtLink class="wordmark" to="/">BLAGOVA<span>SWEETS & LITTLE JOYS</span></NuxtLink>
      <div><span class="eyebrow">BEHIND EVERY LITTLE JOY</span><h1>Вернуться<br><em>к работе.</em></h1><p>Восстановление доступа для сотрудников.</p></div>
      <span class="staff-login-location">PATTAYA, THAILAND · ATELIER WORKSPACE</span>
    </section>
    <section class="staff-login-form">
      <div class="staff-login-card">
        <span class="eyebrow">ДОСТУП СОТРУДНИКА</span>
        <h2>Новый пароль.</h2>
        <p v-if="sent" role="status">Если этот адрес зарегистрирован, письмо с ссылкой отправлено. Откройте его на этом устройстве и задайте новый пароль.</p>
        <form v-else @submit.prevent="submit">
          <label for="recovery-email">Email</label>
          <input id="recovery-email" v-model="email" class="form-input" type="email" autocomplete="email" required maxlength="254" :disabled="busy" />
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button class="btn btn-dark full-width" :disabled="busy">{{ busy ? 'Отправляем…' : 'Отправить ссылку' }}</button>
        </form>
        <NuxtLink class="text-link" to="/login">← Вернуться ко входу</NuxtLink>
      </div>
    </section>
  </main>
</template>
