<template>
  <div class="px-4 py-6 sm:px-0">
    <div class="bg-white rounded-lg shadow px-4 py-6 sm:px-6 text-center">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">欢迎使用 Conf Inject Script</h2>
      <p class="text-gray-600 mb-6">
        请登录以管理您的配置
      </p>
      <router-link 
        to="/login" 
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        前往登录
      </router-link>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeView',
  mounted() {
    // 自动重定向到登录页面
    this.$router.push('/login');
  }
}
</script>