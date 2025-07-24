import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
<script setup>
// 可以在这里添加全局逻辑
</script>

<template>
  <div>
    <router-view />
  </div>
</template>

<style>
/* 可以在这里添加组件特定的样式 */
</style>
