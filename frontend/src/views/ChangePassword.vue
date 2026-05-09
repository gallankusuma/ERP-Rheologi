<template>
  <div class="max-w-lg mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Change Password</h1>
      <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Update your account password</p>
    </div>

    <!-- Form Card -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      <!-- Current Password -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
        <div class="relative">
          <input
            v-model="form.currentPassword"
            :type="showCurrent ? 'text' : 'password'"
            placeholder="Enter your current password"
            class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button
            type="button"
            @click="showCurrent = !showCurrent"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg v-if="!showCurrent" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-gray-200 dark:border-gray-700"></div>

      <!-- New Password -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
        <div class="relative">
          <input
            v-model="form.newPassword"
            :type="showNew ? 'text' : 'password'"
            placeholder="Enter new password (min. 6 characters)"
            class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button
            type="button"
            @click="showNew = !showNew"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg v-if="!showNew" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
            </svg>
          </button>
        </div>
        <!-- Password strength indicator -->
        <div v-if="form.newPassword" class="mt-2">
          <div class="flex gap-1">
            <div
              v-for="i in 4"
              :key="i"
              class="h-1.5 flex-1 rounded-full transition-colors"
              :class="i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-gray-200 dark:bg-gray-600'"
            />
          </div>
          <p class="text-xs mt-1" :class="strengthTextColors[passwordStrength]">
            {{ strengthLabels[passwordStrength] }}
          </p>
        </div>
      </div>

      <!-- Confirm New Password -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm New Password</label>
        <input
          v-model="form.confirmPassword"
          :type="showNew ? 'text' : 'password'"
          placeholder="Re-enter new password"
          class="w-full px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          :class="form.confirmPassword && form.confirmPassword !== form.newPassword
            ? 'border-red-400 dark:border-red-500'
            : form.confirmPassword && form.confirmPassword === form.newPassword
              ? 'border-green-400 dark:border-green-500'
              : 'border-gray-300 dark:border-gray-600'"
        />
        <p v-if="form.confirmPassword && form.confirmPassword !== form.newPassword" class="text-xs text-red-500 mt-1">
          Passwords do not match
        </p>
        <p v-else-if="form.confirmPassword && form.confirmPassword === form.newPassword" class="text-xs text-green-500 mt-1">
          ✓ Passwords match
        </p>
      </div>

      <!-- Error / Success Messages -->
      <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
        {{ error }}
      </div>
      <div v-if="success" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg text-sm">
        {{ success }}
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-2">
        <button
          @click="resetForm"
          class="px-4 py-2.5 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium text-sm"
        >
          Reset
        </button>
        <button
          @click="handleChangePassword"
          :disabled="!canSubmit || loading"
          class="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm flex items-center gap-2"
        >
          <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          {{ loading ? 'Saving...' : 'Change Password' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { api } from '../lib/api';

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const showCurrent = ref(false);
const showNew = ref(false);
const loading = ref(false);
const error = ref('');
const success = ref('');

const passwordStrength = computed(() => {
  const p = form.newPassword;
  if (!p) return 0;
  let score = 0;
  if (p.length >= 6) score++;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return score;
});

const strengthColors: Record<number, string> = {
  0: 'bg-gray-300',
  1: 'bg-red-400',
  2: 'bg-yellow-400',
  3: 'bg-blue-400',
  4: 'bg-green-500',
};

const strengthTextColors: Record<number, string> = {
  0: 'text-gray-400',
  1: 'text-red-500',
  2: 'text-yellow-500',
  3: 'text-blue-500',
  4: 'text-green-500',
};

const strengthLabels: Record<number, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
};

const canSubmit = computed(() => {
  return (
    form.currentPassword.length > 0 &&
    form.newPassword.length >= 6 &&
    form.confirmPassword === form.newPassword
  );
});

const resetForm = () => {
  form.currentPassword = '';
  form.newPassword = '';
  form.confirmPassword = '';
  error.value = '';
  success.value = '';
};

const handleChangePassword = async () => {
  error.value = '';
  success.value = '';

  if (form.newPassword !== form.confirmPassword) {
    error.value = 'New passwords do not match';
    return;
  }

  loading.value = true;
  try {
    await api.put('/users/change-password', {
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
    success.value = 'Password changed successfully! 🎉';
    form.currentPassword = '';
    form.newPassword = '';
    form.confirmPassword = '';
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to change password';
  } finally {
    loading.value = false;
  }
};
</script>
