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
            <span>记住我</span>
          </label>
          <a href="javascript:void(0)">忘记密码？</a>
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


    // Only clear storeSetup from the storage type we're NOT writing to
    const storage = rememberMe.value ? localStorage : sessionStorage
    const otherStorage = rememberMe.value ? sessionStorage : localStorage
    otherStorage.removeItem('storeSetup')

    storage.setItem('TOKEN', data.token)
    storage.setItem('USER_INFO', JSON.stringify(data))
    storage.setItem(
      'storeSetup',
      JSON.stringify({
        configured: !!data.storeConfigured,
        skipped: false,
      }),
    )

    if (rememberMe.value) {
      localStorage.setItem('REMEMBER_USERNAME', form.username)
    } else {
      localStorage.removeItem('REMEMBER_USERNAME')
    }

    if (data.storeConfigured === false) {
      router.push('/store-setup')
    } else {
      router.push('/smartlightdashboard')
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
.auth-page {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: #eef4fb;
  overflow: hidden;
}

.auth-page::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  background-image: url('/backgrounds/bg-day.png');
  background-size: cover;
  background-position: center right;
  background-repeat: no-repeat;
  opacity: 0.95;
  filter: blur(8px);
  transform: scale(1.02);
}

.auth-page::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(90deg, rgba(245, 248, 252, 0.28) 0%, rgba(245, 248, 252, 0.14) 48%, rgba(245, 248, 252, 0.04) 100%);
  pointer-events: none;
}

.auth-shell {
  width: min(100%, 460px);
}

.auth-card {
  width: 100%;
  padding: 30px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.10);
  backdrop-filter: blur(16px);
  box-sizing: border-box;
}

.auth-brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 26px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(219, 234, 254, 0.72));
  border: 1px solid rgba(191, 219, 254, 0.82);
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.brand-mark svg {
  width: 26px;
  height: 26px;
  display: block;
}

.bulb-glow {
  fill: rgba(96, 165, 250, 0.2);
  stroke: #2563eb;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bulb-line {
  fill: none;
  stroke: #1d4ed8;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.auth-brand-row strong {
  color: #111827;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

.form-header h2 {
  margin: 0 0 8px;
  font-size: 26px;
  color: #111827;
}

.form-header p {
  margin: 0 0 24px;
  color: #64748b;
  font-size: 14px;
}

.form-item {
  margin-bottom: 18px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.form-item input {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(203, 213, 225, 0.92);
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.88);
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.form-item input:focus {
  border-color: #60a5fa;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
}

.form-extra {
  margin: 2px 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.remember {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
}

.form-extra a,
.form-footer a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 700;
}

.primary-btn {
  width: 100%;
  height: 44px;
  border: 1px solid #2563eb;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.primary-btn:hover:not(:disabled) {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

.primary-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.form-footer {
  margin-top: 18px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}

@media (max-width: 640px) {
  .auth-page {
    padding: 16px;
  }

  .auth-card {
    padding: 24px 20px;
  }

  .form-header h2 {
    font-size: 20px;
  }

  .form-header p {
    font-size: 12px;
    margin-bottom: 20px;
  }

  .form-item {
    margin-bottom: 14px;
  }

  .form-item label {
    font-size: 12px;
    margin-bottom: 6px;
  }

  .form-item input {
    height: 42px;
    font-size: 13px;
    border-radius: 11px;
  }

  .form-extra {
    font-size: 11px;
    margin-bottom: 16px;
  }

  .primary-btn {
    height: 42px;
    font-size: 14px;
    border-radius: 11px;
  }

  .form-footer {
    font-size: 12px;
    margin-top: 14px;
  }
}
</style>
