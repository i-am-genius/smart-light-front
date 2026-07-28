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
/* Page background, card, inputs, button and footer are provided by AuthShell.
   RegisterView only widens the shell and adds a staggered field entrance. */
:deep(.auth-shell) {
  width: min(100%, 480px);
}

/* Staggered field entrance — fields glide in one after another */
.form-body :deep(.form-item) {
  animation: field-rise 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

.form-body :deep(.form-item:nth-child(1)) { animation-delay: 0.04s; }
.form-body :deep(.form-item:nth-child(2)) { animation-delay: 0.10s; }
.form-body :deep(.form-item:nth-child(3)) { animation-delay: 0.16s; }
.form-body :deep(.form-item:nth-child(4)) { animation-delay: 0.22s; }

.form-body :deep(.primary-btn) {
  animation: field-rise 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) 0.28s both;
}

@keyframes field-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-body :deep(.form-item),
  .form-body :deep(.primary-btn) {
    animation: none;
  }
}
</style>
