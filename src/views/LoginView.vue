<template>
  <div :class="{ shake: shakingFormCard }">
    <AuthShell title="登录账号" subtitle="进入门店灯光、设备与数据看板">
      <form class="form-body" @submit.prevent="handleLogin">
        <div class="form-item">
          <label>账号</label>
          <input
            v-model.trim="form.username"
            type="text"
            placeholder="请输入用户名"
            :class="{ shake: shakingUsername }"
          />
        </div>

        <div class="form-item">
          <label>密码</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :class="{ shake: shakingPassword }"
          />
        </div>

        <div class="form-extra">
          <label class="remember">
            <input v-model="rememberMe" type="checkbox" />
            <span class="checkbox-box" aria-hidden="true">
              <svg viewBox="0 0 12 12" focusable="false">
                <path d="M2.5 6.2l2.2 2.3 4.8-5" />
              </svg>
            </span>
            <span class="remember-text">记住我</span>
          </label>
          <a href="javascript:void(0)" class="forgot-link">忘记密码？</a>
        </div>

        <button class="primary-btn" type="submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <template #footer>
        <div class="form-footer">
          还没有账号？
          <router-link to="/register">立即注册</router-link>
        </div>
      </template>
    </AuthShell>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loginApi } from '../api/auth'
import { useToast } from '../composables/useToast'
import { useShake } from '../composables/useShake'
import AuthShell from '../components/auth/AuthShell.vue'
import { playLoginBeamTransition } from '../components/auth/loginBeamTransition'
import { persistAuthState } from '../utils/authStorage'

const router = useRouter()
const loading = ref(false)
const rememberMe = ref(false)
const toast = useToast()
const { shaking: shakingUsername, trigger: shakeUser } = useShake()
const { shaking: shakingPassword, trigger: shakePwd } = useShake()
const { shaking: shakingFormCard, trigger: shakeFormCard } = useShake()

const form = reactive({
  username: '',
  password: '',
})

function validateForm() {
  if (!form.username) {
    toast.show('请输入用户名', 'error')
    shakeUser()
    return false
  }
  if (!form.password) {
    toast.show('请输入密码', 'error')
    shakePwd()
    return false
  }
  return true
}

async function handleLogin() {
  if (!validateForm()) return

  loading.value = true
  try {
    const res = await loginApi({
      username: form.username,
      password: form.password,
    })
    const result = res.data
    const data = result.data

    if (!data?.token) {
      throw new Error(result.msg || '登录失败，未返回 token')
    }

    persistAuthState(rememberMe.value, localStorage, sessionStorage, {
      token: data.token,
      userInfo: JSON.stringify(data),
      storeSetup: JSON.stringify({
        configured: !!data.storeConfigured,
        skipped: false,
      }),
    })

    if (rememberMe.value) {
      localStorage.setItem('REMEMBER_USERNAME', form.username)
    } else {
      localStorage.removeItem('REMEMBER_USERNAME')
    }

    if (data.storeConfigured === false) {
      router.push('/store-setup')
    } else {
      await playLoginBeamTransition(() => router.push('/smartlightdashboard'))
    }
  } catch (error: any) {
    console.error(error)
    toast.show(error.message || '登录失败，请稍后重试', 'error')
    shakeFormCard()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const savedUsername = localStorage.getItem('REMEMBER_USERNAME')
  if (savedUsername) {
    form.username = savedUsername
    rememberMe.value = true
  }
})
</script>

<style scoped>
/* Layout / card / inputs / buttons are provided by AuthShell.
   This block only styles LoginView-specific pieces. */

/* ===== Remember-me + forgot row ===== */
.form-extra {
  margin: 4px 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.remember {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #9ba8b8;
  cursor: pointer;
  user-select: none;
  transition: color 0.18s ease;
}

.remember:hover {
  color: #c9d1dc;
}

/* Hide the native checkbox but keep it accessible */
.remember input[type='checkbox'] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
}

.checkbox-box {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1.5px solid #475569;
  background: rgba(5, 9, 15, 0.72);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.checkbox-box svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: #fff;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 14;
  stroke-dashoffset: 14;
  transition: stroke-dashoffset 0.22s ease;
}

.remember:hover .checkbox-box {
  border-color: #93c5fd;
}

.remember input[type='checkbox']:focus-visible + .checkbox-box {
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.28);
}

.remember input[type='checkbox']:checked + .checkbox-box {
  border-color: #2563eb;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.28);
}

.remember input[type='checkbox']:checked + .checkbox-box svg {
  stroke-dashoffset: 0;
}

.remember-text {
  line-height: 1;
}

/* ===== Forgot-password link ===== */
.forgot-link {
  color: #78aaf5;
  text-decoration: none;
  font-weight: 700;
}

.forgot-link:hover {
  color: #a7c8ff;
}

/* ===== Night mode ===== */
:global(.app-container.night-mode) .checkbox-box,
:global(body:has(.app-container.night-mode)) .checkbox-box {
  border-color: rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.7);
}

:global(.app-container.night-mode) .remember,
:global(body:has(.app-container.night-mode)) .remember {
  color: #94a3b8;
}

@media (max-width: 640px) {
  .form-extra {
    font-size: 12px;
    margin-bottom: 16px;
  }
}
</style>
