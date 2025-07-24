<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const kvData = ref({});

// 模拟从API获取数据
const fetchData = async () => {
  const response = await fetch('/admin/data');
  if (response.ok) {
    kvData.value = await response.json();
  }
};

// 添加数据
const addValue = async () => {
  const key = document.getElementById('newKey').value;
  const value = document.getElementById('newValue').value;
  if (!key || !value) {
    alert('请输入键和值');
    return;
  }

  const response = await fetch('/admin/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value })
  });

  const result = await response.json();
  alert(result.message);
  if (result.success) {
    fetchData();
  }
};

// 更新数据
const updateValue = async (key) => {
  const textarea = document.querySelector(`textarea[value-key="${key}"]`);
  const value = textarea ? textarea.value : '';

  const response = await fetch('/admin/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value })
  });

  const result = await response.json();
  alert(result.message);
  if (result.success) {
    fetchData();
  }
};

// 删除数据
const deleteValue = async (key) => {
  if (!confirm('确定要删除这个条目吗？')) return;

  const response = await fetch('/admin/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  });

  const result = await response.json();
  alert(result.message);
  if (result.success) {
    fetchData();
  }
};

fetchData();
</script>

<template>
  <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
    <h1 class="text-3xl font-bold text-gray-900">管理平台注入内容</h1>

    <div class="mt-8 flex flex-col">
      <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div class="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    平台名称（键）
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    注入内容（值）
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(value, key) in kvData" :key="key">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{{ key }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <textarea
                      :value="value"
                      :value-key="key"
                      class="value-textarea w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows="3"
                    ></textarea>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button @click="updateValue(key)" class="text-indigo-600 hover:text-indigo-900 mr-4">
                      更新
                    </button>
                    <button @click="deleteValue(key)" class="text-red-600 hover:text-red-900">
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">添加新条目</h2>
      <div class="flex space-x-4">
        <input
          id="newKey"
          type="text"
          placeholder="平台名称（键）"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <textarea
          id="newValue"
          placeholder="注入内容（值）"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          rows="3"
        ></textarea>
        <button
          @click="addValue"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          添加
        </button>
      </div>
    </div>
  </div>
</template>