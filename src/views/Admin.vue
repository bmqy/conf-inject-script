<template>
  <div class="min-h-screen bg-gray-100">
    <!-- 顶部栏 -->
    <div class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <h1 class="text-xl font-bold">Conf Inject Script</h1>
            </div>
          </div>
          <div class="flex items-center">
            <button 
              @click="logout"
              class="ml-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="bg-white rounded-lg shadow px-4 py-6 sm:px-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">管理面板</h2>
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="flex justify-center items-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span class="ml-3 text-gray-600">加载中...</span>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="error" class="rounded-md bg-red-50 p-4 mb-6">
            <div class="text-sm text-red-700">
              {{ error }}
            </div>
            <button 
              @click="loadData"
              class="mt-2 inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              重新加载
            </button>
          </div>

          <!-- 平台注入内容管理 -->
          <div v-else>
            <!-- API Token 配置 -->
            <div class="mb-8">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-gray-900">API Token 配置</h3>
              </div>
              
              <div class="bg-gray-50 rounded-lg p-4 mb-6">
                <div class="grid grid-cols-1 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                    <div class="flex">
                      <input
                        v-model="apiToken"
                        type="text"
                        readonly
                        class="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-100"
                        placeholder="点击生成按钮创建API Token"
                      />
                      <button
                        @click="generateToken"
                        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        随机生成
                      </button>
                    </div>
                    <p class="mt-2 text-sm text-gray-500">
                      生成后可通过 /:platform/:author/{{ apiToken }} 访问合并后的配置文件
                    </p>
                  </div>
                  
                  <div class="flex justify-end">
                    <button
                      @click="saveApiToken"
                      :disabled="savingToken"
                      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      :class="{ 'opacity-50 cursor-not-allowed': savingToken }"
                    >
                      {{ savingToken ? '保存中...' : '保存Token' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 平台注入内容管理 -->
            <div class="mb-8">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-gray-900">平台注入内容</h3>
                <button 
                  @click="showAddPlatformModal = true"
                  class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  添加平台
                </button>
              </div>
              
              <div class="overflow-hidden bg-white shadow sm:rounded-md">
                <ul role="list" class="divide-y divide-gray-200">
                  <li v-for="platform in platforms" :key="platform.name">
                    <div class="px-4 py-4 sm:px-6">
                      <div class="flex items-center justify-between">
                        <p class="truncate text-sm font-medium text-indigo-600">{{ platform.name }}</p>
                        <div class="ml-2 flex flex-shrink-0">
                          <button 
                            @click="editPlatform(platform)"
                            class="mr-2 text-indigo-600 hover:text-indigo-900"
                          >
                            编辑
                          </button>
                          <button 
                            @click="confirmDeletePlatform(platform)"
                            class="text-red-600 hover:text-red-900"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      <div class="mt-2 sm:flex sm:justify-between">
                        <div class="sm:flex">
                          <p class="flex items-center text-sm text-gray-500">
                            内容长度: {{ platform.content.length }} 字符
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li v-if="platforms.length === 0">
                    <div class="px-4 py-6 sm:px-6 text-center text-gray-500">
                      暂无平台注入内容
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <!-- 平台作者配置管理 -->
            <div>
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-gray-900">平台作者配置</h3>
                <button 
                  @click="showAddConfigModal = true"
                  class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  添加配置
                </button>
              </div>
              
              <div class="overflow-hidden bg-white shadow sm:rounded-md">
                <ul role="list" class="divide-y divide-gray-200">
                  <li v-for="config in configs" :key="config.id">
                    <div class="px-4 py-4 sm:px-6">
                      <div class="flex items-center justify-between">
                        <p class="truncate text-sm font-medium text-indigo-600">{{ config.platform }} - {{ config.author }}</p>
                        <div class="ml-2 flex flex-shrink-0">
                          <button 
                            @click="editConfig(config)"
                            class="mr-2 text-indigo-600 hover:text-indigo-900"
                          >
                            编辑
                          </button>
                          <button 
                            @click="confirmDeleteConfig(config)"
                            class="text-red-600 hover:text-red-900"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      <div class="mt-2 sm:flex sm:justify-between">
                        <div class="sm:flex">
                          <p class="flex items-center text-sm text-gray-500 truncate">
                            链接: {{ config.url }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li v-if="configs.length === 0">
                    <div class="px-4 py-6 sm:px-6 text-center text-gray-500">
                      暂无平台作者配置
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑平台模态框 -->
    <div v-if="showAddPlatformModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            {{ editingPlatform ? '编辑平台' : '添加平台' }}
          </h3>
          <form @submit.prevent="savePlatform">
            <div class="mb-4">
              <label class="block text-gray-700 text-sm font-bold mb-2" for="platformName">
                平台名称
              </label>
              <select
                v-model="platformForm.name"
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="platformName"
                :disabled="!!editingPlatform"
                required
              >
                <option value="" disabled selected>请选择平台</option>
                <option 
                  v-for="platform in availablePlatformOptions" 
                  :key="platform" 
                  :value="platform"
                  :disabled="isPlatformExists(platform) && !editingPlatform"
                >
                  {{ platform }} {{ isPlatformExists(platform) && !editingPlatform ? '(已存在)' : '' }}
                </option>
              </select>
            </div>
            <div class="mb-4">
              <label class="block text-gray-700 text-sm font-bold mb-2" for="platformContent">
                注入内容
              </label>
              <textarea
                v-model="platformForm.content"
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="platformContent"
                rows="10"
                placeholder="在此输入平台注入内容"
                required
              ></textarea>
            </div>
            <div class="flex items-center justify-between">
              <button
                type="button"
                @click="showAddPlatformModal = false"
                class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                取消
              </button>
              <button
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                type="submit"
                :disabled="saving"
              >
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 添加/编辑配置模态框 -->
    <div v-if="showAddConfigModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            {{ editingConfig ? '编辑配置' : '添加配置' }}
          </h3>
          <form @submit.prevent="saveConfig">
            <div class="mb-4">
              <label class="block text-gray-700 text-sm font-bold mb-2" for="configPlatform">
                平台
              </label>
              <select
                v-model="configForm.platform"
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="configPlatform"
                required
              >
                <option value="" disabled selected>请选择平台</option>
                <option v-for="platform in availablePlatforms" :key="platform" :value="platform">
                  {{ platform }}
                </option>
              </select>
            </div>
            <div class="mb-4">
              <label class="block text-gray-700 text-sm font-bold mb-2" for="configAuthor">
                作者
              </label>
              <input
                v-model="configForm.author"
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="configAuthor"
                type="text"
                placeholder="例如: bmqy"
                required
              />
            </div>
            <div class="mb-4">
              <label class="block text-gray-700 text-sm font-bold mb-2" for="configUrl">
                配置链接
              </label>
              <input
                v-model="configForm.url"
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="configUrl"
                type="url"
                placeholder="https://example.com/config.conf"
                required
              />
            </div>
            <div class="flex items-center justify-between">
              <button
                type="button"
                @click="showAddConfigModal = false"
                class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                取消
              </button>
              <button
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                type="submit"
                :disabled="saving"
              >
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 删除确认模态框 -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-1/4 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/3 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-center text-gray-900 mt-4 mb-2">
            确认删除
          </h3>
          <div class="text-center text-gray-500 mb-6">
            <p>{{ deleteModalMessage }}</p>
          </div>
          <div class="flex justify-center space-x-4">
            <button
              @click="cancelDelete"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              取消
            </button>
            <button
              @click="confirmDelete"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              :disabled="deleting"
            >
              {{ deleting ? '删除中...' : '删除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 引入通知方法
import { useNotification } from '@kyvg/vue3-notification'

export default {
  name: 'AdminView',
  setup() {
    // 使用通知方法
    const { notify } = useNotification()
    return { notify }
  },
  data() {
    return {
      // 预定义的平台列表
      availablePlatforms: [
        'quantumultx',
        'loon',
        'shadowrocket',
        'surge',
        'clash',
        'stash'
      ],
      platforms: [],
      configs: [],
      apiToken: '',
      loading: true,
      saving: false,
      savingToken: false,
      deleting: false,
      error: null,
      showAddPlatformModal: false,
      showAddConfigModal: false,
      showDeleteModal: false,
      editingPlatform: null,
      editingConfig: null,
      pendingDelete: null,
      deleteModalMessage: '',
      platformForm: {
        name: '',
        content: ''
      },
      configForm: {
        platform: '',
        author: '',
        url: ''
      }
    }
  },
  computed: {
    // 计算可用于添加新平台的选项（排除已存在的平台）
    availablePlatformOptions() {
      return this.availablePlatforms.filter(platform => {
        // 如果正在编辑平台，允许选择当前平台
        if (this.editingPlatform && this.editingPlatform.name === platform) {
          return true;
        }
        // 否则只返回尚未存在的平台
        return !this.platforms.some(p => p.name === platform);
      });
    }
  },
  created() {
    this.loadData();
  },
  methods: {
    logout() {
      // 清除认证信息
      localStorage.removeItem('authToken');
      // 跳转到登录页面
      this.$router.push('/login');
    },
    async loadData() {
      this.loading = true;
      this.error = null;
      
      try {
        // 获取平台注入内容
        const platformsResponse = await fetch('/api/platforms', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (!platformsResponse.ok) {
          throw new Error('获取平台数据失败');
        }
        
        this.platforms = await platformsResponse.json();
        
        // 获取平台作者配置
        const configsResponse = await fetch('/api/configs', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (!configsResponse.ok) {
          throw new Error('获取配置数据失败');
        }
        
        this.configs = await configsResponse.json();
        
        // 获取API Token
        const tokenResponse = await fetch('/api/token', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          this.apiToken = tokenData.token || '';
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        this.error = error.message || '加载数据失败，请稍后重试';
      } finally {
        this.loading = false;
      }
    },
    // 生成随机Token
    generateToken() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 16; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      this.apiToken = token;
    },
    // 保存API Token
    async saveApiToken() {
      this.savingToken = true;
      
      try {
        const response = await fetch('/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ token: this.apiToken })
        });
        
        if (!response.ok) {
          throw new Error('保存Token失败');
        }
        
        const result = await response.json();
        if (result.success) {
          // 使用toast提示替代alert
          this.notify({
            title: "成功",
            text: "Token保存成功!",
            type: "success"
          });
        } else {
          throw new Error(result.message || '保存Token失败');
        }
      } catch (error) {
        console.error('保存Token失败:', error);
        this.notify({
          title: "错误",
          text: "保存Token失败: " + (error.message || '未知错误'),
          type: "error"
        });
      } finally {
        this.savingToken = false;
      }
    },
    // 检查平台是否已存在
    isPlatformExists(platform) {
      return this.platforms.some(p => p.name === platform);
    },
    editPlatform(platform) {
      this.editingPlatform = platform
      this.platformForm = { ...platform }
      this.showAddPlatformModal = true
    },
    // 确认删除平台
    confirmDeletePlatform(platform) {
      this.pendingDelete = { type: 'platform', item: platform };
      this.deleteModalMessage = `确定要删除平台 "${platform.name}" 吗？此操作无法撤销。`;
      this.showDeleteModal = true;
    },
    // 确认删除配置
    confirmDeleteConfig(config) {
      this.pendingDelete = { type: 'config', item: config };
      this.deleteModalMessage = `确定要删除配置 "${config.platform} - ${config.author}" 吗？此操作无法撤销。`;
      this.showDeleteModal = true;
    },
    // 取消删除
    cancelDelete() {
      this.showDeleteModal = false;
      this.pendingDelete = null;
      this.deleteModalMessage = '';
    },
    // 确认删除
    async confirmDelete() {
      if (this.pendingDelete) {
        this.deleting = true;
        try {
          if (this.pendingDelete.type === 'platform') {
            await this.deletePlatform(this.pendingDelete.item.name);
          } else if (this.pendingDelete.type === 'config') {
            await this.deleteConfig(this.pendingDelete.item.id);
          }
        } catch (error) {
          console.error('删除失败:', error);
          this.notify({
            title: "错误",
            text: "删除失败: " + (error.message || '未知错误'),
            type: "error"
          });
        } finally {
          this.deleting = false;
          this.cancelDelete();
        }
      }
    },
    async deletePlatform(name) {
      const response = await fetch(`/api/platforms/${name}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除平台失败');
      }
      
      // 从本地列表中移除
      this.platforms = this.platforms.filter(p => p.name !== name);
    },
    async savePlatform() {
      this.saving = true;
      
      try {
        const url = this.editingPlatform 
          ? `/api/platforms/${this.platformForm.name}`
          : '/api/platforms';
          
        const method = this.editingPlatform ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(this.platformForm)
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '保存平台失败');
        }
        
        // 重新加载数据
        await this.loadData();
        
        // 重置表单
        this.platformForm = { name: '', content: '' }
        this.editingPlatform = null
        this.showAddPlatformModal = false
        
        this.notify({
          title: "成功",
          text: "平台保存成功!",
          type: "success"
        });
      } catch (error) {
        console.error('保存平台失败:', error);
        this.notify({
          title: "错误",
          text: "保存平台失败: " + (error.message || '未知错误'),
          type: "error"
        });
      } finally {
        this.saving = false;
      }
    },
    editConfig(config) {
      this.editingConfig = config
      this.configForm = { ...config }
      this.showAddConfigModal = true
    },
    async deleteConfig(id) {
      const response = await fetch(`/api/configs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除配置失败');
      }
      
      // 从本地列表中移除
      this.configs = this.configs.filter(c => c.id !== id);
    },
    async saveConfig() {
      this.saving = true;
      
      try {
        const url = this.editingConfig 
          ? `/api/configs/${this.configForm.id}`
          : '/api/configs';
          
        const method = this.editingConfig ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(this.configForm)
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '保存配置失败');
        }
        
        // 重新加载数据
        await this.loadData();
        
        // 重置表单
        this.configForm = { platform: '', author: '', url: '' }
        this.editingConfig = null
        this.showAddConfigModal = false
        
        this.notify({
          title: "成功",
          text: "配置保存成功!",
          type: "success"
        });
      } catch (error) {
        console.error('保存配置失败:', error);
        this.notify({
          title: "错误",
          text: "保存配置失败: " + (error.message || '未知错误'),
          type: "error"
        });
      } finally {
        this.saving = false;
      }
    }
  }
}
</script>