<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 overflow-hidden relative">
    <!-- Decorative background elements -->
    <div class="absolute top-0 left-0 w-96 h-96 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
    <div class="absolute bottom-0 right-0 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
    <div class="absolute top-1/2 left-1/3 w-72 h-72 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-4000"></div>

    <!-- Leaf decorations -->
    <div class="absolute top-10 left-10 text-6xl opacity-10 animate-bounce">🌿</div>
    <div class="absolute top-32 right-20 text-5xl opacity-10 animate-bounce animation-delay-1000">🍃</div>
    <div class="absolute bottom-32 left-20 text-5xl opacity-10 animate-bounce animation-delay-2000">🌱</div>
    <div class="absolute bottom-10 right-10 text-6xl opacity-10 animate-bounce animation-delay-3000">🌾</div>

    <div class="max-w-md w-full mx-4">
      <!-- Login Card -->
      <div v-if="!showRegister" class="bg-white/95 backdrop-blur-sm shadow-2xl rounded-3xl p-8 border border-green-100 transition-all duration-500 transform">
        <!-- Logo & Title -->
        <div class="text-center mb-8">
          <div class="text-5xl mb-3 animate-pulse">🌿</div>
          <h1 class="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
            VortexMfg
          </h1>
          <p class="text-emerald-600 text-sm font-medium">Sustainable Manufacturing Intelligence</p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg text-sm">
          {{ error }}
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="space-y-5">
          <div>
            <label for="email" class="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input
              v-model="form.email"
              type="email"
              id="email"
              required
              placeholder="you@example.com"
              class="w-full px-4 py-3 border-2 border-green-100 rounded-xl bg-green-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 transition-all"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              v-model="form.password"
              type="password"
              id="password"
              required
              placeholder="••••••••"
              class="w-full px-4 py-3 border-2 border-green-100 rounded-xl bg-green-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 transition-all"
            />
          </div>

          <!-- Remember & Forgot Password -->
          <div class="flex items-center justify-between text-sm">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" class="w-4 h-4 text-emerald-600 rounded border-green-300 focus:ring-emerald-500">
              <span class="text-gray-600">Remember me</span>
            </label>
            <a href="#" class="text-emerald-600 hover:text-emerald-700 font-medium">Forgot password?</a>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
          >
            <span v-if="!loading">Sign In</span>
            <span v-else class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </span>
          </button>
        </form>

        <!-- Divider -->
        <div class="my-6 flex items-center gap-4">
          <div class="flex-1 h-px bg-green-200"></div>
          <span class="text-gray-500 text-sm">New here?</span>
          <div class="flex-1 h-px bg-green-200"></div>
        </div>

        <!-- Register Toggle -->
        <button
          @click="showRegister = true"
          class="w-full py-3 px-4 rounded-xl font-semibold border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all duration-200"
        >
          Create Account
        </button>
      </div>

      <!-- Register Card -->
      <div v-else class="bg-white/95 backdrop-blur-sm shadow-2xl rounded-3xl p-8 border border-green-100 transition-all duration-500 transform">
        <!-- Logo & Title -->
        <div class="text-center mb-8">
          <div class="text-5xl mb-3 animate-pulse">🌱</div>
          <h2 class="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
            Join VortexMfg
          </h2>
          <p class="text-emerald-600 text-sm font-medium">Start your sustainable manufacturing journey</p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg text-sm">
          {{ error }}
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="space-y-5">
          <div>
            <label for="reg-name" class="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
            <input
              v-model="registerForm.name"
              type="text"
              id="reg-name"
              required
              placeholder="John Doe"
              class="w-full px-4 py-3 border-2 border-green-100 rounded-xl bg-green-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 transition-all"
            />
          </div>

          <div>
            <label for="reg-email" class="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input
              v-model="registerForm.email"
              type="email"
              id="reg-email"
              required
              placeholder="you@example.com"
              class="w-full px-4 py-3 border-2 border-green-100 rounded-xl bg-green-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 transition-all"
            />
          </div>

          <div>
            <label for="reg-password" class="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              v-model="registerForm.password"
              type="password"
              id="reg-password"
              required
              minlength="6"
              placeholder="Min. 6 characters"
              class="w-full px-4 py-3 border-2 border-green-100 rounded-xl bg-green-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 transition-all"
            />
          </div>

          <div>
            <label for="reg-confirm" class="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
            <input
              v-model="registerForm.confirmPassword"
              type="password"
              id="reg-confirm"
              required
              minlength="6"
              placeholder="Confirm password"
              class="w-full px-4 py-3 border-2 border-green-100 rounded-xl bg-green-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 transition-all"
            />
          </div>

          <!-- Terms checkbox -->
          <label class="flex items-start space-x-3 cursor-pointer">
            <input v-model="registerForm.agreedToTerms" type="checkbox" class="w-5 h-5 text-emerald-600 rounded border-green-300 focus:ring-emerald-500 mt-0.5">
            <span class="text-sm text-gray-600">I agree to the <a href="#" class="text-emerald-600 hover:underline font-medium">Terms of Service</a> and <a href="#" class="text-emerald-600 hover:underline font-medium">Privacy Policy</a></span>
          </label>

          <button
            type="submit"
            :disabled="loading || !registerForm.agreedToTerms"
            class="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
          >
            <span v-if="!loading">Create Account</span>
            <span v-else class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating account...
            </span>
          </button>
        </form>

        <!-- Divider -->
        <div class="my-6 flex items-center gap-4">
          <div class="flex-1 h-px bg-green-200"></div>
          <span class="text-gray-500 text-sm">Already have account?</span>
          <div class="flex-1 h-px bg-green-200"></div>
        </div>

        <!-- Back to Login -->
        <button
          @click="showRegister = false"
          class="w-full py-3 px-4 rounded-xl font-semibold border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all duration-200"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  email: '',
  password: '',
});

const registerForm = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreedToTerms: false,
});

const loading = ref(false);
const error = ref('');
const showRegister = ref(false);

const handleLogin = async () => {
  loading.value = true;
  error.value = '';
  try {
    await authStore.login(form.value.email, form.value.password);
    router.push('/');
  } catch (err: any) {
    error.value = err.error || 'Login failed. Please check your credentials.';
  } finally {
    loading.value = false;
  }
};

const handleRegister = async () => {
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    error.value = 'Passwords do not match.';
    return;
  }

  if (!registerForm.value.agreedToTerms) {
    error.value = 'Please agree to the terms and conditions.';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    await authStore.register(registerForm.value.name, registerForm.value.email, registerForm.value.password);
    router.push('/');
  } catch (err: any) {
    error.value = err.error || 'Registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
@keyframes pulse-slow {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.3; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

.animation-delay-1000 {
  animation-delay: 1s;
}

.animation-delay-3000 {
  animation-delay: 3s;
}
</style>
