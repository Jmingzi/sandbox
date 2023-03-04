import { defineConfig } from 'dumi'

export default defineConfig({
  outputPath: 'docs-dist',
  base: '/ui/xapp-docs/',
  publicPath: process.env.NODE_ENV === 'development' ? '/' : '/ui/xapp-docs/',
  themeConfig: {
    name: 'xapp',
    logo: 'http://fe.shinemo.com/logo.png',
    socialLinks: {
      github: 'https://git.shinemo.com/projects/BAAS/repos/xapp/browse',
      linkedin: 'http://10.0.10.212:8081/job/xapp-docs/'
    },
    footer: 'Copyright © 2023 | Powered by 讯盟 FE',
    nav: [
      {
        title: '指南',
        link: '/guide'
      },
      {
        title: '前端框架',
        link: '/xapp-core'
      },
      {
        title: '业务基座',
        link: '/xapp-main'
      },
      {
        title: '开发调试工具',
        link: '/xapp-tools'
      },
      {
        title: '应用开发教程',
        link: '/guide-app-develop'
      }
    ],
    sidebar: {
      '/guide': [
        {
          title: '介绍',
          children: [
            {
              title: '什么是 xapp',
              link: '/guide'
            }
          ]
        },
        {
          title: '生态共建',
          children: [
            {
              title: '介绍',
              link: '/guide/contribute'
            }
          ]
        },
        {
          title: '常见问题',
          children: [
            {
              title: 'QA',
              link: '/guide/qa'
            }
          ]
        }
      ],
      '/xapp-core': [
        {
          title: '介绍',
          children: [
            {
              title: '快速上手',
              link: '/xapp-core'
            }
          ]
        },
        {
          title: '核心特性',
          children: [
            {
              title: '路由',
              link: '/xapp-core/theory-intercept'
            },
            {
              title: '应用配置表',
              link: '/xapp-core/api-apps-config'
            },
            {
              title: '通信',
              link: '/xapp-core/theory-event'
            },
            {
              title: '沙箱',
              link: '/xapp-core/theory-sandbox'
            },
            {
              title: '插件',
              link: '/xapp-core/theory-plugin'
            }
          ]
        },
        {
          title: 'API 定义',
          children: [
            {
              title: '路由',
              link: '/xapp-core/api-route'
            },
            {
              title: '访问者(Visitor)',
              link: '/xapp-core/api-visitor'
            },
            {
              title: '沙箱',
              link: '/xapp-core/api-sandbox'
            },
            {
              title: '插件',
              link: '/xapp-core/api-plugin'
            }
          ]
        }
      ],
      '/xapp-main': [
        {
          title: '介绍',
          children: [
            {
              title: '快速上手',
              link: '/xapp-main'
            }
          ]
        },
        {
          title: '能力',
          children: [
            {
              title: 'CsrfToken',
              link: '/xapp-main/basics-csrf-token'
            },
            {
              title: '共享数据',
              link: '/xapp-main/basics-data-share'
            },
            {
              title: '权限认证',
              link: '/xapp-main/basics-permission-auth'
            },
            {
              title: '国际化',
              link: '/xapp-main/basics-i18n'
            },
            {
              title: '通信',
              link: '/xapp-main/basics-communication'
            },
            {
              title: '请求',
              link: '/xapp-main/basics-request'
            },
            {
              title: '组件',
              link: '/xapp-main/g'
            }
          ]
        },
        {
          title: '进阶',
          children: [
            {
              title: '项目升级指引🔥',
              link: '/xapp-main/upgrade'
            },
            {
              title: '应用模版定制',
              link: '/xapp-main/template'
            },
            {
              title: '插件开发',
              link: '/xapp-core/theory-plugin'
            },
            {
              title: '独立运行',
              link: '/xapp-main/advanced'
            }
          ]
        }
      ],
      '/guide-app-develop': [
        {
          title: '引导',
          children: [
            {
              title: '概述',
              link: '/guide-app-develop'
            }
          ]
        },
        {
          title: '基座',
          children: [
            {
              title: '集成',
              link: '/guide-app-develop/integration'
            },
            {
              title: '能力',
              link: '/guide-app-develop/ability'
            }
          ]
        },
        {
          title: '应用开发',
          children: [
            {
              title: '应用创建',
              link: '/guide-app-develop/create'
            },
            {
              title: '基座能力使用',
              link: '/guide-app-develop/ability-to-use'
            },
            {
              title: '应用发布上架',
              link: '/guide-app-develop/publish'
            }
          ]
        },
        {
          title: 'API',
          children: [
            {
              title: 'request',
              link: '/guide-app-develop/request'
            },
            {
              title: 'loginInfo',
              link: '/guide-app-develop/login-info'
            },
            {
              title: 'permission',
              link: '/guide-app-develop/permission'
            },
            {
              title: 'customEvent',
              link: '/guide-app-develop/custom-event'
            }
          ]
        },
        {
          title: 'PC端',
          children: [
            {
              title: '介绍',
              link: '/guide-app-develop/pc'
            }
          ]
        }
      ]
    }
  },
  styles: [
    `.dumi-default-logo img {
  border-radius: 50%;
  overflow: hidden;
}`
  ]
})
