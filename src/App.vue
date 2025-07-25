<template>
  <div class="min-h-screen bg-gray-100">
    <nav v-if="!isLoginPage" class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <h1 class="text-xl font-bold">Conf Inject Script</h1>
            </div>
            <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
              <router-link 
                v-if="isLoggedIn"
                to="/admin" 
                class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                管理面板
              </router-link>
            </div>
          </div>
          <div class="flex items-center">
            <button 
              v-if="isLoggedIn"
              @click="logout"
              class="ml-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </nav>

    <main>
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <router-view />
      </div>
    </main>
    
    <!-- 添加通知组件 -->
    <notifications />
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      isLoggedIn: false
    }
  },
  computed: {
    isLoginPage() {
      return this.$route.path === '/login';
    }
  },
  created() {
    // 页面加载时检查登录状态
    this.checkLoginStatus();
    
    // 监听路由变化
    this.$watch('$route', () => {
      this.checkLoginStatus();
    });
  },
  methods: {
    checkLoginStatus() {
      // 检查是否有有效的登录令牌
      const token = localStorage.getItem('authToken');
      this.isLoggedIn = !!token;
    },
    logout() {
      // 清除认证信息
      localStorage.removeItem('authToken');
      this.isLoggedIn = false;
      // 跳转到首页
      this.$router.push('/');
    },
  }
}
</script>