<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-50 overflow-hidden relative">
    <!-- Animated background video/animation -->
    <div class="absolute inset-0 overflow-hidden">
      <!-- SVG Background with elegant patterns -->
      <svg class="absolute inset-0 w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="flowGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#06B6D4;stop-opacity:0.15" />
            <stop offset="100%" style="stop-color:#0891B2;stop-opacity:0.05" />
          </linearGradient>
          <linearGradient id="flowGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#059669;stop-opacity:0.15" />
            <stop offset="100%" style="stop-color:#047857;stop-opacity:0.05" />
          </linearGradient>
        </defs>
        
        <!-- Flowing lines animation -->
        <g class="animated-particles">
          <path d="M 0 100 Q 300 50, 600 100 T 1200 100" stroke="url(#flowGrad1)" stroke-width="4" fill="none" class="animate-flow-1"/>
          <path d="M 0 300 Q 300 250, 600 300 T 1200 300" stroke="url(#flowGrad2)" stroke-width="4" fill="none" class="animate-flow-3"/>
          <path d="M 0 500 Q 300 450, 600 500 T 1200 500" stroke="url(#flowGrad1)" stroke-width="4" fill="none" class="animate-flow-1"/>
          <path d="M 0 700 Q 300 650, 600 700 T 1200 700" stroke="url(#flowGrad2)" stroke-width="4" fill="none" class="animate-flow-4"/>
        </g>

        <!-- Geometric accent circles -->
        <g class="floating-elements" opacity="0.1">
          <circle cx="100" cy="150" r="60" fill="none" stroke="#06B6D4" stroke-width="1" class="animate-float-1"/>
          <circle cx="200" cy="600" r="50" fill="none" stroke="#06B6D4" stroke-width="1" class="animate-float-2"/>
          <circle cx="1100" cy="300" r="70" fill="none" stroke="#059669" stroke-width="1" class="animate-float-3"/>
          <circle cx="900" cy="200" r="55" fill="none" stroke="#059669" stroke-width="1" class="animate-float-4"/>
        </g>

        <!-- X pattern elements (AQUION inspired) -->
        <g opacity="0.08" class="animate-pulse-slow">
          <path d="M 150 100 L 250 200" stroke="#06B6D4" stroke-width="2"/>
          <path d="M 250 100 L 150 200" stroke="#06B6D4" stroke-width="2"/>
          
          <path d="M 1050 600 L 1150 700" stroke="#059669" stroke-width="2"/>
          <path d="M 1150 600 L 1050 700" stroke="#059669" stroke-width="2"/>
          
          <path d="M 550 200 L 650 300" stroke="#06B6D4" stroke-width="1.5"/>
          <path d="M 650 200 L 550 300" stroke="#06B6D4" stroke-width="1.5"/>
        </g>

        <!-- Subtle accent dots -->
        <g opacity="0.15" class="animate-pulse">
          <circle cx="300" cy="250" r="6" fill="#06B6D4"/>
          <circle cx="800" cy="550" r="6" fill="#06B6D4"/>
          <circle cx="500" cy="150" r="4" fill="#059669"/>
          <circle cx="1000" cy="700" r="4" fill="#059669"/>
          <circle cx="200" cy="400" r="5" fill="#06B6D4"/>
          <circle cx="950" cy="350" r="5" fill="#059669"/>
        </g>
      </svg>
    </div>

    <!-- Decorative colored overlays -->
    <div class="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-cyan-300 to-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse" style="animation-delay: 0s;"></div>
    <div class="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-emerald-300 to-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse" style="animation-delay: 2s;"></div>
    <div class="absolute top-1/2 left-1/3 w-72 h-72 bg-gradient-to-r from-blue-200 to-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style="animation-delay: 4s;"></div>

    <!-- Acceleration themed decorations -->
    <div class="absolute top-10 left-10 text-6xl opacity-10 animate-bounce">⚡</div>
    <div class="absolute top-32 right-20 text-5xl opacity-10 animate-bounce animation-delay-1000">�</div>
    <div class="absolute bottom-32 left-20 text-5xl opacity-10 animate-bounce animation-delay-2000">🌊</div>
    <div class="absolute bottom-10 right-10 text-6xl opacity-10 animate-bounce animation-delay-3000">✨</div>

    <div class="max-w-md w-full mx-4 relative z-10">
      <!-- Login Card -->
      <div v-if="!showRegister" class="bg-white/90 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-cyan-200 transition-all duration-500 transform hover:shadow-cyan-200/50 hover:shadow-2xl">
        <!-- Logo & Title -->
        <div class="text-center mb-8">
          <img src="@/assets/logo/xlerate-logo.svg" alt="X Lerate" class="w-16 h-16 mx-auto mb-3">
          <h1 class="text-3xl font-black bg-gradient-to-r from-cyan-600 to-gray-900 bg-clip-text text-transparent mb-2 tracking-tighter">X <span class="text-gray-900">Lerate</span></h1>
          <p class="text-gray-600 text-sm font-bold uppercase tracking-widest">Advanced Hydro-Fiber Manufacturing</p>
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
              class="w-full px-4 py-3 border-2 border-cyan-200 rounded-xl bg-cyan-50/50 focus:outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-300 transition-all"
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
              class="w-full px-4 py-3 border-2 border-cyan-200 rounded-xl bg-cyan-50/50 focus:outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-300 transition-all"
            />
          </div>

          <!-- Remember & Forgot Password -->
          <div class="flex items-center justify-between text-sm">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" class="w-4 h-4 text-cyan-600 rounded border-cyan-300 focus:ring-cyan-500">
              <span class="text-gray-600">Remember me</span>
            </label>
            <a href="#" class="text-cyan-600 hover:text-cyan-700 font-medium">Forgot password?</a>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-gradient-to-r from-cyan-600 via-emerald-600 to-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 text-lg"
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
          <div class="flex-1 h-px bg-cyan-200"></div>
          <span class="text-gray-500 text-sm">New here?</span>
          <div class="flex-1 h-px bg-cyan-200"></div>
        </div>

        <!-- Register Toggle -->
        <button
          @click="showRegister = true"
          class="w-full py-3 px-4 rounded-xl font-semibold border-2 border-cyan-300 text-cyan-600 hover:bg-cyan-50 transition-all duration-200"
        >
          Create Account
        </button>
      </div>

      <!-- Register Card -->
      <div v-else class="bg-white/90 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-emerald-200 transition-all duration-500 transform hover:shadow-emerald-200/50 hover:shadow-2xl max-w-sm w-full">
        <!-- Logo & Title -->
        <div class="text-center mb-8">
          <img src="@/assets/logo/xlerate-logo.svg" alt="X Lerate" class="w-16 h-16 mx-auto mb-3">
          <h2 class="text-3xl font-black bg-gradient-to-r from-emerald-600 to-gray-900 bg-clip-text text-transparent mb-2 tracking-tighter">X <span class="text-gray-900">Lerate</span></h2>
          <p class="text-gray-600 text-sm font-bold uppercase tracking-widest">Join the Hydro-Fiber Revolution</p>
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
              class="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl bg-emerald-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-300 transition-all"
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
              class="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl bg-emerald-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-300 transition-all"
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
              class="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl bg-emerald-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-300 transition-all"
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
              class="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl bg-emerald-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-300 transition-all"
            />
          </div>

          <!-- Terms checkbox -->
          <label class="flex items-start space-x-3 cursor-pointer">
            <input v-model="registerForm.agreedToTerms" type="checkbox" class="w-5 h-5 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 mt-0.5">
            <span class="text-sm text-gray-600">I agree to the <a href="#" class="text-emerald-600 hover:underline font-medium">Terms of Service</a> and <a href="#" class="text-emerald-600 hover:underline font-medium">Privacy Policy</a></span>
          </label>

          <button
            type="submit"
            :disabled="loading || !registerForm.agreedToTerms"
            class="w-full bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 text-lg"
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
          <div class="flex-1 h-px bg-emerald-200"></div>
          <span class="text-gray-500 text-sm">Already have account?</span>
          <div class="flex-1 h-px bg-emerald-200"></div>
        </div>

        <!-- Back to Login -->
        <button
          @click="showRegister = false"
          class="w-full py-3 px-4 rounded-xl font-semibold border-2 border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition-all duration-200"
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
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.25; }
}

@keyframes pulse-fast {
  0%, 100% { opacity: 0.2; }
  25% { opacity: 0.4; }
  50% { opacity: 0.35; }
  75% { opacity: 0.25; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

@keyframes float-lightning {
  0%, 100% { transform: translate(0, 0); opacity: 0.3; }
  50% { transform: translate(5px, 10px); opacity: 0.5; }
}

@keyframes float-arrows {
  0% { transform: translateX(-30px); opacity: 0.1; }
  50% { transform: translateX(30px); opacity: 0.3; }
  100% { transform: translateX(80px); opacity: 0; }
}

@keyframes flow-wave {
  0% { stroke-dashoffset: 1000; }
  100% { stroke-dashoffset: 0; }
}

@keyframes flow-wave-fast {
  0% { stroke-dashoffset: 1000; }
  100% { stroke-dashoffset: 0; }
}

.animate-pulse-slow {
  animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-pulse-fast {
  animation: pulse-fast 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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

.animate-flow-1 {
  animation: flow-wave 6s linear infinite;
  stroke-dasharray: 1000;
}

.animate-flow-2 {
  animation: flow-wave 8s linear infinite;
  stroke-dasharray: 1000;
  animation-delay: 2s;
}

.animate-flow-2-fast {
  animation: flow-wave-fast 4s linear infinite;
  stroke-dasharray: 1000;
  animation-delay: 1s;
}

.animate-flow-3 {
  animation: flow-wave 7s linear infinite;
  stroke-dasharray: 1000;
  animation-delay: 4s;
}

.animate-flow-4 {
  animation: flow-wave 9s linear infinite;
  stroke-dasharray: 1000;
  animation-delay: 6s;
}

.animate-flow-4-fast {
  animation: flow-wave 5s linear infinite;
  stroke-dasharray: 1000;
  animation-delay: 3s;
}

.animate-float-1 {
  animation: float 6s ease-in-out infinite;
}

.animate-float-2 {
  animation: float 7s ease-in-out infinite;
  animation-delay: 1s;
}

.animate-float-3 {
  animation: float 8s ease-in-out infinite;
  animation-delay: 2s;
}

.animate-float-4 {
  animation: float 9s ease-in-out infinite;
  animation-delay: 3s;
}

.animate-float-4-speed {
  animation: float 5s ease-in-out infinite;
  animation-delay: 2s;
}

.animate-float-lightning {
  animation: float-lightning 3s ease-in-out infinite;
}

.animate-float-arrows {
  animation: float-arrows 2s ease-in infinite;
}
</style>
