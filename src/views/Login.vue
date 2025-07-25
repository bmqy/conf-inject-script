<template>
  <div class="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 overflow-hidden">
    <div class="max-w-md w-full space-y-8">
      <div class="bg-white rounded-2xl shadow-xl p-8 sm:p-10">
        <div class="text-center">
          <div class="mx-auto h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
            <svg class="h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="mt-6 text-3xl font-extrabold text-gray-900">
            登录到管理面板
          </h2>
          <p class="mt-2 text-sm text-gray-600">
            请输入您的账号和密码
          </p>
        </div>
        
        <form class="mt-8 space-y-6" @submit.prevent="login">
          <div v-if="errorMessage" class="rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-700">
              {{ errorMessage }}
            </div>
          </div>
          
          <div class="rounded-md space-y-4">
            <div>
              <label for="username" class="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                id="username"
                name="username"
                type="text"
                autocomplete="username"
                required
                v-model="form.username"
                class="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition duration-200"
                placeholder="请输入用户名"
              />
            </div>
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                v-model="form.password"
                class="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition duration-200"
                placeholder="请输入密码"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="loading"
              class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200"
              :class="{ 'opacity-50 cursor-not-allowed': loading }"
            >
              <span v-if="loading" class="absolute left-0 inset-y-0 flex items-center pl-3">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
              {{ loading ? '登录中...' : '登录' }}
            </button>
          </div>
        </form>
      </div>
      
      <div class="text-center text-xs text-gray-500">
        <p>© {{ new Date().getFullYear() }} Conf Inject Script. 保留所有权利.</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginView',
  data() {
    return {
      form: {
        username: '',
        password: ''
      },
      errorMessage: '',
      loading: false
    }
  },
  methods: {
    async login() {
      this.loading = true;
      this.errorMessage = '';
      
      try {
        // 发送登录请求到后端API
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.form)
        });
        
        const data = await response.json();
        
        if (data.success) {
          // 登录成功，保存令牌到本地存储
          localStorage.setItem('authToken', data.token);
          
          // 更新父组件的登录状态
          if (this.$root && typeof this.$root.checkLoginStatus === 'function') {
            this.$root.checkLoginStatus();
          }
          
          // 跳转到管理面板
          this.$router.push('/admin');
        } else {
          // 登录失败，显示错误消息
          this.errorMessage = data.message || '登录失败';
        }
      } catch (error) {
        // 网络错误或其他异常
        console.error('Login error:', error);
        this.errorMessage = '无法连接到服务器，请确保后端服务正在运行';
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>

<style scoped>
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* Webkit浏览器隐藏滚动条 */
::-webkit-scrollbar {
  display: none;
}

/* Firefox隐藏滚动条 */
html {
  scrollbar-width: none;
  overflow: hidden;
}

/* 确保整个页面没有滚动条 */
.fixed {
  overflow: hidden;
}
</style>