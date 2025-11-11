import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import ComponentDemo from '../views/ComponentDemo.vue'
import MicroAgentTest from '../views/MicroAgentTest.vue'

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
    path: '/test',
    name: 'test',
    component: MicroAgentTest,
    meta: {
      title: 'Micro Agent 测试'
    }
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