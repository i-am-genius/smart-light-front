<template>
  <div class="auth-page">
    <div class="auth-shell">
      <div class="auth-side">
        <div class="brand">
          <div class="brand-badge">SMART LIGHT</div>
          <h1>智能服装照明管理平台</h1>
          <p>
            面向服装门店的智能灯光控制与设备管理系统，
            支持设备接入、智能调光、风格匹配和实时状态监控。
          </p>
        </div>

        <div class="feature-list">
          <div class="feature-item">
            <span class="dot"></span>
            <div>
              <h3>智能调光</h3>
              <p>结合环境光、人流与推荐策略动态调节亮度与色温</p>
            </div>
          </div>

          <div class="feature-item">
            <span class="dot"></span>
            <div>
              <h3>设备联动</h3>
              <p>支持灯具、传感器与摄像头设备统一接入和状态同步</p>
            </div>
          </div>

          <div class="feature-item">
            <span class="dot"></span>
            <div>
              <h3>场景适配</h3>
              <p>根据门店陈列与服装展示需求生成更合适的灯光方案</p>
            </div>
          </div>
        </div>

        <div class="tag-group">
          <span>服装门店</span>
          <span>分区管理</span>
          <span>色温调节</span>
          <span>智能联动</span>
        </div>
      </div>

      <div class="auth-main">
        <div class="form-card" :class="{ shake: shakingFormCard }">
          <div class="form-header">
            <h2>欢迎登录</h2>
            <p>请输入账号信息进入系统</p>
          </div>

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
              {{ loading ? '登录中...' : '登 录' }}
            </button>

            <div class="form-footer">
              还没有账号？
              <router-link to="/register">立即注册</router-link>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loginApi } from '../api/auth'
import { useToast } from '../composables/useToast'
import { useShake } from '../composables/useShake'

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


    localStorage.removeItem('TOKEN')
    localStorage.removeItem('USER_INFO')
    localStorage.removeItem('storeSetup')
    sessionStorage.removeItem('TOKEN')
    sessionStorage.removeItem('USER_INFO')
    sessionStorage.removeItem('storeSetup')

    const storage = rememberMe.value ? localStorage : sessionStorage

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
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(79, 70, 229, 0.16), transparent 28%),
    radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.14), transparent 28%),
    linear-gradient(135deg, #f5f7fb 0%, #eef2ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.auth-shell {
  width: 1120px;
  min-height: 680px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: 28px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
}

.auth-side {
  padding: 56px 48px;
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.95), rgba(79, 70, 229, 0.92));
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.brand-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.2);
  font-size: 12px;
  letter-spacing: 1px;
  margin-bottom: 18px;
}

.brand h1 {
  margin: 0 0 16px;
  font-size: 34px;
  line-height: 1.25;
  font-weight: 700;
}

.brand p {
  margin: 0;
  line-height: 1.8;
  color: rgba(255,255,255,0.9);
  font-size: 15px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin: 42px 0;
}

.feature-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.dot {
  width: 10px;
  height: 10px;
  margin-top: 9px;
  border-radius: 50%;
  background: #fff;
  flex-shrink: 0;
  box-shadow: 0 0 0 6px rgba(255,255,255,0.12);
}

.feature-item h3 {
  margin: 0 0 6px;
  font-size: 17px;
}

.feature-item p {
  margin: 0;
  color: rgba(255,255,255,0.86);
  line-height: 1.7;
  font-size: 14px;
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-group span {
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.18);
}

.auth-main {
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-card {
  width: 100%;
  max-width: 420px;
  padding: 36px 34px;
  border-radius: 24px;
  background: rgba(255,255,255,0.92);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.form-header h2 {
  margin: 0 0 8px;
  font-size: 28px;
  color: #111827;
}

.form-header p {
  margin: 0 0 28px;
  color: #6b7280;
  font-size: 14px;
}

.form-item {
  margin-bottom: 18px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
}

.form-item input {
  width: 100%;
  height: 46px;
  border-radius: 14px;
  border: 1px solid #dbe3f0;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.form-item input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08);
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
  color: #6b7280;
}

.form-extra a,
.form-footer a {
  color: #4f46e5;
  text-decoration: none;
  font-weight: 600;
}

.primary-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.22);
}

.primary-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.form-footer {
  margin-top: 18px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

@media (max-width: 960px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }

  .auth-side {
    padding: 36px 28px;
  }

  .auth-main {
    padding: 24px;
  }
}

@media (max-width: 640px) {
  .auth-side {
    padding: 28px 20px;
  }

  .brand-badge {
    font-size: 10px;
    padding: 4px 10px;
    margin-bottom: 12px;
  }

  .brand h1 {
    font-size: 20px;
  }

  .brand p {
    font-size: 11px;
    line-height: 1.4;
  }

  .feature-item h3 {
    font-size: 13px;
  }

  .feature-item p {
    font-size: 11px;
  }

  .feature-list {
    gap: 14px;
    margin: 24px 0;
  }

  .tag-group {
    gap: 6px;
  }

  .tag-group span {
    font-size: 10px;
    padding: 4px 8px;
  }

  .auth-main {
    padding: 16px;
  }

  .form-card {
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
    font-size: 11px;
    margin-bottom: 4px;
  }

  .form-item input {
    height: 40px;
    font-size: 13px;
    border-radius: 10px;
    padding: 0 10px;
  }

  .form-extra {
    font-size: 11px;
    margin-bottom: 16px;
  }

  .primary-btn {
    height: 42px;
    font-size: 14px;
    border-radius: 10px;
  }

  .form-footer {
    font-size: 12px;
    margin-top: 14px;
  }
}
</style>
