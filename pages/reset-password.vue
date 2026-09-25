<script setup lang="ts">
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
definePageMeta({ layout: false });
useHead({ title: 'Новый пароль · BLAGOVA SWEETS', htmlAttrs: { lang: 'ru' } });
const password = ref('');
const confirmation = ref('');
const ready = ref(false);
const busy = ref(false);
const complete = ref(false);
const error = ref('');
const config = useRuntimeConfig().public;
let recoveryClient: SupabaseClient | null = null;
let checkTimer: ReturnType<typeof setInterval> | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  const query = new URLSearchParams(window.location.search);
  if (query.has('error')) {
    window.history.replaceState(window.history.state, '', window.location.pathname);
    error.value = 'Ссылка недействительна или срок её действия истёк. Запросите новое письмо.';
    return;
  }
  let handled = false;
  const checkLink = async () => {
    if (handled) return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (!fragment.has('access_token') && !fragment.has('error')) return;
    handled = true;
    clearInterval(checkTimer);
    clearTimeout(expiryTimer);
    // Remove credentials from browser history as soon as they are captured.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (fragment.has('error')) {
      error.value = 'Ссылка недействительна или срок её действия истёк. Запросите новое письмо.';
      return;
    }
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    if (fragment.get('type') !== 'recovery' || !accessToken || !refreshToken) {
      error.value = 'Ссылка восстановления неполная. Запросите новое письмо.';
      return;
    }
    try {
      recoveryClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error: sessionError } = await recoveryClient.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionError) throw sessionError;
      const { data, error: userError } = await recoveryClient.auth.getUser();
      if (userError || !data.user) throw userError || new Error('No user');
      ready.value = true;
    } catch {
      error.value = 'Не удалось подтвердить ссылку. Запросите новое письмо.';
    }
  };
  void checkLink();
  // Nuxt can finish normalizing a static route after the component mounts.
  // Give the browser a moment to restore the URL fragment before declaring it absent.
  checkTimer = setInterval(() => { void checkLink(); }, 100);
  expiryTimer = setTimeout(() => {
    clearInterval(checkTimer);
    if (!handled) error.value = 'Откройте ссылку из письма восстановления пароля.';
  }, 2000);
});

onBeforeUnmount(() => {
  clearInterval(checkTimer);
  clearTimeout(expiryTimer);
});

async function submit() {
  if (!ready.value || busy.value || !recoveryClient) return;
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/.test(password.value)) {
    error.value = 'Не менее 8 символов: строчная и заглавная буквы, цифра и спецсимвол.';
    return;
  }
  if (password.value !== confirmation.value) {
    error.value = 'Пароли не совпадают.';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const { error: authError } = await recoveryClient.auth.updateUser({ password: password.value });
    if (authError) throw authError;
    password.value = '';
    confirmation.value = '';
    ready.value = false;
    complete.value = true;
  } catch {
    error.value = 'Не удалось сохранить пароль. Запросите новую ссылку и повторите.';
  } finally {
    busy.value = false;
  }
  if (complete.value) await recoveryClient.auth.signOut({ scope: 'local' }).catch(() => {});
}
</script>

<template>
  <main class="staff-login">
    <section class="staff-login-story">
      <NuxtLink class="wordmark" to="/">BLAGOVA<span>SWEETS & LITTLE JOYS</span></NuxtLink>
      <div><span class="eyebrow">BEHIND EVERY LITTLE JOY</span><h1>Новый<br><em>пароль.</em></h1><p>Доступ к рабочему пространству BLAGOVA.</p></div>
      <span class="staff-login-location">PATTAYA, THAILAND · ATELIER WORKSPACE</span>
    </section>
    <section class="staff-login-form">
      <div class="staff-login-card">
        <span class="eyebrow">ДОСТУП СОТРУДНИКА</span>
        <h2>Задайте пароль.</h2>
        <p v-if="complete" role="status">Пароль сохранён. Теперь войдите с вашим email и новым паролем.</p>
        <p v-else-if="!ready && !error" role="status">Проверяем ссылку…</p>
        <form v-if="ready && !complete" @submit.prevent="submit">
          <label for="new-password">Новый пароль</label>
          <input id="new-password" v-model="password" class="form-input" type="password" autocomplete="new-password" required minlength="8" maxlength="72" :disabled="busy" />
          <label for="confirm-password">Повторите пароль</label>
          <input id="confirm-password" v-model="confirmation" class="form-input" type="password" autocomplete="new-password" required minlength="8" maxlength="72" :disabled="busy" />
          <p>Не менее 8 символов: строчная и заглавная буквы, цифра и спецсимвол.</p>
          <button class="btn btn-dark full-width" :disabled="busy">{{ busy ? 'Сохраняем…' : 'Сохранить пароль' }}</button>
        </form>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <NuxtLink v-if="complete" class="text-link" to="/login">Перейти ко входу →</NuxtLink>
        <NuxtLink v-else-if="!ready" class="text-link" to="/forgot-password">Запросить новую ссылку →</NuxtLink>
      </div>
    </section>
  </main>
</template>
