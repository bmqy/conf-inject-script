<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          登录到管理面板
        </h2>
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="login">
        <div v-if="errorMessage" class="rounded-md bg-red-50 p-4">
          <div class="text-sm text-red-700">
            {{ errorMessage }}
          </div>
        </div>
        <input type="hidden" name="remember" value="true" />
        <div class="rounded-md shadow-sm -space-y-px">
          <div>
            <label for="username" class="sr-only">用户名</label>
            <input
              id="username"
              name="username"
              type="text"
              autocomplete="username"
              required
              v-model="form.username"
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="用户名"
            />
          </div>
          <div>
            <label for="password" class="sr-only">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              v-model="form.password"
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="密码"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
      <div class="text-center text-sm text-gray-500 mt-4">
        <p>默认账号: admin</p>
        <p>默认密码: password</p>
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
          this.$root.isLoggedIn = true;
          
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