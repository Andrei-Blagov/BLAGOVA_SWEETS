<template>
    <div class="min-h-screen flex flex-col">
        <Header />
        <main class="flex-1">
            <NuxtPage />
        </main>
        <Footer />
    </div>
</template>

<script setup lang="ts">
import Header from '~/components/Header.vue'
import Footer from '~/components/Footer.vue'
</script>
