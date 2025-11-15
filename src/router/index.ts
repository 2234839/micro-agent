import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import ComponentDemo from '../views/ComponentDemo.vue'
import MicroAgentTest from '../views/MicroAgentTest.vue'
import TokenSpeedTest from '../views/TokenSpeedTest.vue'
import LayoutView from '../views/LayoutView.vue'

/**
 * 路由配置
 */
const routes = [
  {
    path: '/',
    name: 'home',
    component: Home,
    meta: {
      title: 'Micro Agent'
    }
  },
  {
    path: '/demo',
    name: 'demo',
    component: ComponentDemo,
    meta: {
      title: '组件库演示'
    }
  },
  {
    path: '/',
    component: LayoutView,
    children: [
      {
        path: 'test',
        name: 'test',
        component: MicroAgentTest,
        meta: {
          title: 'Micro Agent Chat',
          showBackButton: true,
          showClearButton: true,
          showSettingsButton: true
        }
      },
      {
        path: 'token-speed-test',
        name: 'token-speed-test',
        component: TokenSpeedTest,
        meta: {
          title: 'AI Token 速度测试',
          showBackButton: true,
          showClearButton: true,
          showSettingsButton: true
        }
      }
    ]
  }
]

/**
 * 创建路由实例
 */
const router = createRouter({
  history: createWebHistory(),
  routes
})

/**
 * 路由守卫 - 设置页面标题
 */
router.beforeEach((to, from, next) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }
  next()
})

export default router