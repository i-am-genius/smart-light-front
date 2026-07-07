<template>
  <div :class="{ shake: shakingFormCard }">
    <AuthShell title="注册账号" subtitle="注册成功后进入门店信息初始化">
      <form class="form-body" @submit.prevent="handleRegister">
        <div class="form-item">
          <label>用户名</label>
          <input v-model.trim="form.username" type="text" placeholder="请输入用户名" :class="{ shake: shakingUsername }" />
        </div>

        <div class="form-item">
          <label>手机号</label>
          <input v-model.trim="form.phone" type="tel" maxlength="11" placeholder="请输入手机号" :class="{ shake: shakingPhone }" />
        </div>

        <div class="form-item">
          <label>密码</label>
          <input v-model="form.password" type="password" placeholder="请输入密码" :class="{ shake: shakingPassword }" />
        </div>

        <div class="form-item">
          <label>确认密码</label>
          <input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" :class="{ shake: shakingConfirmPwd }" />
        </div>

        <button class="primary-btn" type="submit" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>

      <template #footer>
        <div class="form-footer">
          已有账号？
          <a href="javascript:void(0)" @click="goLogin">返回登录</a>
        </div>
      </template>
    </AuthShell>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '../api/http'
import { loginApi } from '../api/auth'
import { useToast } from '../composables/useToast'
import { useShake } from '../composables/useShake'
import AuthShell from '../components/auth/AuthShell.vue'

const router = useRouter()
const loading = ref(false)
const toast = useToast()
const { shaking: shakingUsername, trigger: shakeUsername } = useShake()
const { shaking: shakingPhone, trigger: shakePhone } = useShake()
const { shaking: shakingPassword, trigger: shakePassword } = useShake()
const { shaking: shakingConfirmPwd, trigger: shakeConfirmPwd } = useShake()
const { shaking: shakingFormCard, trigger: shakeFormCard } = useShake()

const form = reactive({
  username: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

function validateForm() {
  if (!form.username) {
    toast.show('请输入用户名', 'error')
    shakeUsername()
    return false
  }
  if (!form.phone) {
    toast.show('请输入手机号', 'error')
    shakePhone()
    return false
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    toast.show('手机号格式不正确', 'error')
    shakePhone()
    return false
  }
  if (!form.password) {
    toast.show('请输入密码', 'error')
    shakePassword()
    return false
  }
  if (!form.confirmPassword) {
    toast.show('请再次输入密码', 'error')
    shakeConfirmPwd()
    return false
  }
  if (form.password !== form.confirmPassword) {
    toast.show('两次输入的密码不一致', 'error')
    shakeConfirmPwd()
    return false
  }
  return true
}

async function handleRegister() {
  if (!validateForm()) return

  loading.value = true
  try {
    await http.post('/api/auth/register', {
      username: form.username,
      phone: form.phone,
      password: form.password,
      confirmPassword: form.confirmPassword,
    })

    const loginRes = await loginApi({
      username: form.username,
      password: form.password,
    })
    const result = loginRes.data
    const data = result.data

    if (!data?.token) {
      throw new Error(result.msg || '登录失败，未返回 token')
    }

    // Clean stale storeSetup from sessionStorage (we always write to localStorage here)
    sessionStorage.removeItem('storeSetup')
    localStorage.setItem('TOKEN', data.token)
    localStorage.setItem('USER_INFO', JSON.stringify(data))

    router.push('/store-setup')
  } catch (error: any) {
    console.error(error)
    toast.show(error.message || '注册失败，请稍后重试', 'error')
    shakeFormCard()
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.push('/login')
}
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
  width: min(100%, 480px);
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
  margin-bottom: 24px;
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

.primary-btn {
  width: 100%;
  height: 44px;
  margin-top: 8px;
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

.form-footer a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 700;
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

  .primary-btn {
    height: 42px;
    font-size: 14px;
    border-radius: 11px;
    margin-top: 4px;
  }

  .form-footer {
    font-size: 12px;
    margin-top: 14px;
  }
}
</style>
