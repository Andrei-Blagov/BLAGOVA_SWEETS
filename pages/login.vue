<script setup lang="ts">
definePageMeta({ layout: false });
useHead({ title: 'Вход · BLAGOVA SWEETS', htmlAttrs: { lang: 'ru' } });
const { login, verify } = useStaffAuth();
const email = ref('');
const password = ref('');
const visible = ref(false);
const busy = ref(false);
const checking = ref(true);
const error = ref('');
onMounted(async () => {
  try { if (await verify()) await navigateTo('/admin', { replace: true }); }
  catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось проверить доступ.'; }
  finally { checking.value = false; }
});
async function submit() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { await login(email.value, password.value); password.value = ''; await navigateTo('/admin', { replace: true }); }
  catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось войти.'; }
  finally { busy.value = false; }
}
</script>
<template>
  <main class="staff-login">
    <section class="staff-login-story">
      <NuxtLink class="wordmark" to="/">BLAGOVA<span>SWEETS & LITTLE JOYS</span></NuxtLink>
      <div><span class="eyebrow">BEHIND EVERY LITTLE JOY</span><h1>Забота начинается<br><em>за кулисами.</em></h1><p>Заказы, разговоры и маленькие детали,<br>из которых складывается большой день.</p></div>
      <span class="staff-login-location">PATTAYA, THAILAND · ATELIER WORKSPACE</span>
    </section>
    <section class="staff-login-form">
      <div class="staff-login-card">
        <span class="eyebrow">ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</span>
        <h2>С возвращением.</h2><p>Вход для владельца и сотрудников BLAGOVA.</p>
        <p v-if="checking" role="status">Проверяем сессию…</p>
        <form v-else @submit.prevent="submit">
          <label for="staff-email">Email</label><input id="staff-email" v-model="email" class="form-input" type="email" autocomplete="username" required maxlength="254" :disabled="busy" />
          <label for="staff-password">Пароль</label>
          <div class="staff-password"><input id="staff-password" v-model="password" class="form-input" :type="visible ? 'text' : 'password'" autocomplete="current-password" required maxlength="200" :disabled="busy" /><button type="button" :aria-pressed="visible" @click="visible = !visible">{{ visible ? 'Скрыть' : 'Показать' }}</button></div>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button class="btn btn-dark full-width" :disabled="busy">{{ busy ? 'Входим…' : 'Войти в рабочее пространство' }}<AtelierIcon v-if="!busy" name="arrow" /></button>
        </form>
        <p class="staff-login-note">Доступ определяется ролью сотрудника. Регистрация посетителя не открывает админку.</p>
        <NuxtLink class="text-link" to="/">← Вернуться на сайт</NuxtLink>
        <NuxtLink class="staff-demo-link" to="/demo-admin">Посмотреть локальное демо без входа</NuxtLink>
      </div>
    </section>
  </main>
</template>
