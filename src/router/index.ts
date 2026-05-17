import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import SmartLightDashboard from '../views/SmartLightDashboard.vue'
import StoreSetupView from '../views/StoreSetup.vue'
import StoreProfileView from '../views/StoreProfileView.vue'

function getStoreSetupState() {
  const rawStoreSetup =
    localStorage.getItem('storeSetup') || sessionStorage.getItem('storeSetup')
  const rawUserInfo =
    localStorage.getItem('USER_INFO') || sessionStorage.getItem('USER_INFO')

  let storeSetup: any = null
  let userInfo: any = null

  try {
    storeSetup = rawStoreSetup ? JSON.parse(rawStoreSetup) : null
  } catch {
    storeSetup = null
  }

  try {
    userInfo = rawUserInfo ? JSON.parse(rawUserInfo) : null
  } catch {
    userInfo = null
  }

  return {
    storeConfigured: Boolean(
      storeSetup?.configured === true ||
      storeSetup?.storeConfigured === true ||
      userInfo?.storeConfigured === true,
    ),
    storeSkipped: Boolean(
      storeSetup?.skipped === true ||
      storeSetup?.storeSkipped === true,
    ),
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/smartlightdashboard',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
    },
    {
      path: '/store-setup',
      name: 'StoreSetup',
      component: StoreSetupView,
      meta: { requiresAuth: true },
    },
    {
      path: '/smartlightdashboard',
      name: 'smartlightdashboard',
      component: SmartLightDashboard,
      meta: { requiresAuth: true },
    },
    {
      path: '/store-profile',
      name: 'StoreProfile',
      component: StoreProfileView,
      meta: { requiresAuth: true },
    },
    {
      path: '/firmware-manage',
      name: 'FirmwareManage',
      redirect: {
        path: '/smartlightdashboard',
        query: { tab: 'firmware' },
      },
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN')
  const { storeConfigured, storeSkipped } = getStoreSetupState()

  if (to.meta.requiresAuth && !token) {
    return '/login'
  }

  if ((to.path === '/login' || to.path === '/register') && token) {
    if (!storeConfigured && !storeSkipped) {
      return '/store-setup'
    }
    return '/smartlightdashboard'
  }

  if (
    token &&
    !storeConfigured &&
    !storeSkipped &&
    to.path !== '/store-setup'
  ) {
    return '/store-setup'
  }

  if (token && storeConfigured && to.path === '/store-setup') {
    return '/smartlightdashboard'
  }

  return true
})

export default router
