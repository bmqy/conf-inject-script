<template>
  <div class="px-4 py-6 sm:px-0">
    <div class="bg-white rounded-lg shadow px-4 py-6 sm:px-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">欢迎使用 Conf Inject Script</h2>
      <p class="text-gray-600 mb-4">
        这是一个用于配置文件注入的工具，支持多种平台（如 Quantumult X、Loon、Shadowrocket 等）。
      </p>
      <div class="mt-6">
        <h3 class="text-lg font-medium text-gray-900">使用方法</h3>
        <ul class="mt-2 list-disc pl-5 space-y-1 text-gray-600">
          <li>管理员可以通过管理面板配置各平台的注入内容</li>
          <li>用户可以通过特定URL获取合并后的配置文件</li>
          <li>支持 Quantumult X、Loon、Shadowrocket 等平台</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeView'
}
</script>