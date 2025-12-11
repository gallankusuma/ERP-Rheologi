<template>
  <div id="app">
    <Layout v-if="showChrome" />
    <RouterView v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { RouterView } from 'vue-router';
import Layout from './components/Layout.vue';

const route = useRoute();
const showChrome = computed(() => route.name !== 'Login');
</script>
