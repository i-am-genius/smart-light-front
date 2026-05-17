<template>
  <div class="auth-page">
    <div class="auth-shell">
      <div class="auth-side register-side">
        <div>
          <div class="brand-badge">REGISTER</div>
          <h1>创建你的系统账号</h1>
          <p class="side-desc">
            注册页仅保留基础账号信息，注册成功后将进入门店初始化页面，
            再完善店铺名称、面积、风格、城市等资料，整体流程更清晰。
          </p>
        </div>

        <div class="scene-card-list">
          <div class="scene-card">
            <h3>第一步：账号注册</h3>
            <p>用户名 / 手机号 / 密码，先快速完成注册</p>
          </div>
          <div class="scene-card">
            <h3>第二步：店铺初始化</h3>
            <p>注册成功后再填写店铺名称、面积、城市、风格</p>
          </div>

        </div>

        <div class="tag-group">
          <span>快速注册</span>
          <span>两步完成</span>
          <span>安全登录</span>
        </div>
      </div>

      <div class="auth-main">
        <div class="form-card">
          <div class="form-header">
            <h2>欢迎注册</h2>
            <p>请填写基础信息，创建你的系统账号</p>
          </div>

          <form class="form-body" @submit.prevent="handleRegister">
            <div class="form-item">
              <label>用户名</label>
              <input v-model.trim="form.username" type="text" placeholder="请输入用户名" />
            </div>

            <div class="form-item">
              <label>手机号</label>
              <input v-model.trim="form.phone" type="tel" maxlength="11" placeholder="请输入手机号" />
            </div>

            <div class="form-item">
              <label>密码</label>
              <input v-model="form.password" type="password" placeholder="请输入密码" />
            </div>

            <div class="form-item">
              <label>确认密码</label>
              <input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" />
            </div>

            <button class="primary-btn" type="submit" :disabled="loading">
              {{ loading ? '注册中...' : '注 册' }}
            </button>

            <div class="form-footer">
              已有账号？
              <a href="javascript:void(0)" @click="goLogin">返回登录</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '../api/http'
import { loginApi } from '../api/auth'

const router = useRouter()
const loading = ref(false)

const form = reactive({
  username: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

function validateForm() {
  if (!form.username) {
    alert('请输入用户名')
    return false
  }
  if (!form.phone) {
    alert('请输入手机号')
    return false
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    alert('手机号格式不正确')
    return false
  }
  if (!form.password) {
    alert('请输入密码')
    return false
  }
  if (!form.confirmPassword) {
    alert('请再次输入密码')
    return false
  }
  if (form.password !== form.confirmPassword) {
    alert('两次输入的密码不一致')
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

    localStorage.setItem('TOKEN', data.token)
    localStorage.setItem('USER_INFO', JSON.stringify(data))

    router.push('/store-setup')
  } catch (error: any) {
    console.error(error)
    alert(error.message || '注册失败，请稍后重试')
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

.register-side h1 {
  margin: 0 0 14px;
  font-size: 34px;
  line-height: 1.25;
}

.side-desc {
  margin: 0;
  font-size: 15px;
  line-height: 1.8;
  color: rgba(255,255,255,0.9);
}

.scene-card-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin: 36px 0;
}

.scene-card {
  padding: 18px 16px;
  border-radius: 18px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.14);
}

.scene-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.scene-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(255,255,255,0.88);
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
  max-width: 430px;
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

.primary-btn {
  width: 100%;
  height: 48px;
  margin-top: 8px;
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

.form-footer a {
  color: #4f46e5;
  text-decoration: none;
  font-weight: 600;
}


@media (max-width: 960px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }

  .scene-card-list {
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

  .register-side h1 {
    font-size: 20px;
  }

  .side-desc {
    font-size: 11px;
    line-height: 1.4;
  }

  .scene-card-list {
    gap: 10px;
    margin: 20px 0;
  }

  .scene-card {
    padding: 14px;
  }

  .scene-card h3 {
    font-size: 13px;
  }

  .scene-card p {
    font-size: 11px;
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

  .primary-btn {
    height: 42px;
    font-size: 14px;
    border-radius: 10px;
    margin-top: 4px;
  }

  .form-footer {
    font-size: 12px;
    margin-top: 14px;
  }
}
</style>
