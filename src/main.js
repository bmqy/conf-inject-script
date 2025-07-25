import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import Login from './views/Login.vue'
import Admin from './views/Admin.vue'
import './style.css'

// 引入通知插件
import Notifications from '@kyvg/vue3-notification'

// 定义路由
const routes = [
  { path: '/', redirect: '/login' }, // 根路径重定向到登录页
  { path: '/login', component: Login },
  { path: '/admin', component: Admin, meta: { requiresAuth: true } }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes
})

// 添加导航守卫
router.beforeEach((to, from, next) => {
  // 检查路由是否需要认证
  if (to.meta.requiresAuth) {
    // 检查用户是否已登录
    const token = localStorage.getItem('authToken')
    if (token) {
      // 已登录，允许访问
      next()
    } else {
      // 未登录，重定向到登录页面
      next('/login')
    }
  } else {
    // 不需要认证的路由，直接访问
    next()
  }
})

// 创建Vue应用并使用路由
const app = createApp(App)
app.use(router)
app.use(Notifications)
app.mount('#app')