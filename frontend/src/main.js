import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const app = createApp(App);

import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Admin from './views/Admin.vue';

// 定义路由
const routes = [
  { path: '/', redirect: '/login' },  // 添加根路径重定向
  { path: '/login', component: Login },
  { path: '/admin', component: Admin }
];

// 创建路由器
const router = createRouter({
  history: createWebHistory(),
  routes
});

// 挂载路由器
app.use(router);

// 挂载应用
app.mount('#app');
