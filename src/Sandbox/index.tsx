import React, { useRef, useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react'
import {
  setSandboxCache,
  getSandbox,
  resetUrlForRefresh,
  syncAppPlaceholderStyleToIframe,
  syncAppSizeToIframe,
  parseHTML,
  HTMLTag,
  HTMLLoaderOption,
  addScriptToBody,
  log
} from './utils'
import {
  loadIframe,
  resetIframeDOM,
  stopIframeLoading,
  syncUrlToIframe,
  // syncUrlToIframe,
  // syncUrlToWindow,
  watchIframeHashChange,
  watchWindowHashChange
} from './iframe'
import { throttle } from 'lodash'
import { APP_ACTIVE_SCRIPT_CLASS } from './constant'

if (!window.__XXX__) {
  /**
   * 出现这种情况一般为子项目热更新
   * 整个 reload 后就会丢失注入的内容
   * 需要通知主项目也 reload
   */
  if (window.top && window.top !== window.self) {
    console.warn('[sandbox]: window.__XXX__ 不存在')
    window.top.location.reload()
    // 停止运行下面的逻辑
    window?.stop()
  }
  // 不允许直接覆盖 window.__XXX__
  Object.defineProperty(window, '__XXX__', {
    value: {},
    configurable: false
  })
}

window.__XXX__.sandboxCache ||= new Map()

type SandboxOptions = {
  name: string
  entry:
    | string
    | {
        js: string // 子应用 js
        html?: string // 子应用入口
        template?: string // 子应用模版
      }
  inject: (context?: Window) => any
  htmlLoader?: (htmlNode: HTMLLoaderOption) => HTMLLoaderOption
}
type SandboxSetupOptions = {
  el: HTMLDivElement
}
type SandboxIframe = HTMLIFrameElement & { contentWindow: Window }

function XLoading () {
  // 自实现
}

export class Sandbox {
  public name: string
  public entry: {
    js: string // 子应用 js
    html?: string // 子应用入口
    template?: string // 子应用模版
  }

  /** 注入当前应用 window 上下文的函数 */
  public inject: SandboxOptions['inject']
  /** 子应用挂载的容器 */
  public el: HTMLDivElement
  public iframe: SandboxIframe
  public iframeReady: Promise<any>
  /** iframe 中子应用资源加载完毕后触发的回调 */
  public iframeOnLoadCallback?: () => void

  /** 将模版的 html 交给用户处理 */
  public htmlLoader?: SandboxOptions['htmlLoader']
  /** 应用是否激活 */
  public activated: boolean = false
  /** 应用是被初始化 */
  public isInitialed: boolean = false
  /** 应用保活状态 */
  public aliveState: 'display' | 'hidden'
  /** 模版解析提取的内容 */
  public templateResult?: {
    html: string
    scripts: HTMLTag[]
    links: HTMLTag[]
    styles: HTMLTag[]
  }

  /** 子应用容器样式变化同步到 iframe 的回调 */
  private onResizeSyncToIframe: () => void

  /** 使用模版加载 iframe */
  get useTemplate() {
    return !this.entry.html
  }

  get isAliveDisplay() {
    return this.aliveState === 'display'
  }

  /** 使用主项目 html 作为模版加载 iframe */
  get useMainAppHTMLAsTemplate() {
    return !this.entry.html && !this.entry.template
  }

  constructor(options: SandboxOptions) {
    this.name = options.name
    this.entry = typeof options.entry === 'string' ? { js: options.entry } : options.entry
    this.inject = options.inject
    this.htmlLoader = options.htmlLoader

    setSandboxCache(this.name, this)
    this.log('sandbox constructor')
  }

  async startApp({ el }: SandboxSetupOptions) {
    this.el = el

    if (!this.isInitialed) {
      await this.setupApp()
    }

    if (this.activated) {
      this.log('restart app')
      // 重新激活时去除 loading
      this.iframeOnLoadCallback?.()
    } else {
      // 激活
      await this.activeApp()
    }
    // 将 url 同步给 iframeWindow
    /** todo 本地开发模式下，不同域的 history 操作会报安全错误 */
    // syncUrlToIframe(this.iframe.contentWindow, this.name)
    // 使 window url 上的子应用路由标记和 window hash 一致
    // syncUrlToWindow(this.iframe.contentWindow, this.name)

    // 显示在视图
    this.aliveDisplay()
  }

  /**
   * 初始化应用配置
   */
  async setupApp() {
    // 模版模式下初始化 iframe
    if (this.useTemplate) {
      this.log(
        `use ${
          this.useMainAppHTMLAsTemplate ? 'main html as' : 'specific entry.template as'
        } template load app. parseTemplate`
      )
      this.templateResult = await parseHTML(
        this.useMainAppHTMLAsTemplate ? window.location.href : this.entry.template!,
        this.htmlLoader
      )
      // 挂载 iframe
      this.log('1.load iframe with main app host')
      this.iframe = loadIframe(window.location.href, this.name) as SandboxIframe
      // 重新组装 iframe DOM
      this.iframeReady = stopIframeLoading(this.iframe.contentWindow)
    } else {
      /** 指定 html 的子应用，当成普通的网页加载 */
      // 刷新浏览器时，将窗口的 url 同步给子应用
      const iframeSrc = resetUrlForRefresh(this.entry.html!, this.name)
      this.iframeReady = this.generatorIframeApp(iframeSrc)
    }

    const iframeWindow = this.iframe.contentWindow
    // hash 互相同步
    watchWindowHashChange(iframeWindow)
    watchIframeHashChange(iframeWindow)

    this.onResizeSyncToIframe = throttle(() => {
      syncAppSizeToIframe(this.el, this.iframe)
    }, 100)

    this.isInitialed = true
  }

  /**
   * 激活应用
   * 1. 保持路由同步
   * 2. 注入主项目上下文
   */
  async activeApp() {
    // 注入上下文
    this.patchIframe()
    if (this.useTemplate) {
      // iframe 组装完成
      await this.iframeReady
      const activeSteps: HTMLTag[] = [
        // 执行子应用
        {
          tag: 'script',
          attrs: {
            class: APP_ACTIVE_SCRIPT_CLASS,
            src: this.entry.js,
            flag: 'sub-app-entry-inject'
          }
        },
        // 加载完成
        {
          tag: 'script',
          attrs: {
            class: APP_ACTIVE_SCRIPT_CLASS
          },
          content: 'setTimeout(function(){ window.__XXX__.sandbox.iframeOnLoadCallback() }, 500)'
        }
      ]
      // 添加到 iframe
      const doc = this.iframe.contentDocument!
      // 执行子应用 js
      activeSteps.forEach(item => {
        addScriptToBody(item, doc)
      })
      this.log('active app, run app entry.js')
      // 仅仅是记录
      this.templateResult?.scripts.push(...activeSteps)
    } else {
      this.log('active app, do nothing')
    }

    this.iframe.removeAttribute('deactivated')
    this.activated = true
  }

  /**
   * 失活应用
   * 保持 iframe 资源
   */
  deactivated() {
    const iframeWindow = this.iframe.contentWindow
    // 执行应用的卸载
    iframeWindow.__XXX_UNMOUNT__?.()

    if (this.useTemplate) {
      if (this.templateResult) {
        this.templateResult.scripts = this.templateResult.scripts.filter(
          x => x.attrs.class !== APP_ACTIVE_SCRIPT_CLASS
        )
      }
      // 卸载 iframe 中不是 template 的 DOM 节点
      resetIframeDOM(iframeWindow)
    }

    // 移除 bus 注册的事件
    iframeWindow.__XXX__ = {}
    this.aliveHidden()
    this.activated = false
    this.iframe.setAttribute('deactivated', '')
    this.log('deactivated, reset iframe DOM, remove __XXX__ and route sync')
  }

  /**
   * 默认应用为保活
   * 保活应用显示
   */
  aliveDisplay() {
    // 监听 el 的样式变化同步给 iframe
    syncAppPlaceholderStyleToIframe(this.el, this.iframe)

    // 防止重复监听
    window.removeEventListener('resize', this.onResizeSyncToIframe)
    window.addEventListener('resize', this.onResizeSyncToIframe)

    this.iframe.style.display = ''
    this.iframe.setAttribute('alive-state', 'display')
    this.aliveState = 'display'
    this.log('alive displayed')

    // 同步路由
    syncUrlToIframe(this.iframe.contentWindow, this.name)
  }

  /**
   * 保活应用切换隐藏
   */
  aliveHidden() {
    this.iframe.style.display = 'none'
    this.iframe.setAttribute('alive-state', 'hidden')
    window.removeEventListener('resize', this.onResizeSyncToIframe)
    this.aliveState = 'hidden'
    this.log('alive hidden')
  }

  /**
   * 卸载子应用
   * 目前还不需要用到
   */
  destroy() {
    // 清理
  }

  /**
   * 子应用预加载
   * 根据模版提前创建好 iframe
   * 预加载后只需要激活
   */
  async preload() {
    if (this.useTemplate) {
      this.log('preload')
      await this.setupApp()
    } else {
      console.warn('当前应用不支持预加载')
    }
  }

  patchIframe() {
    this.log('patchIframe with inject and __XXX__')
    // const name = this.name
    const iframeWindow = this.iframe.contentWindow
    // const history = iframeWindow.history
    // const rawHistoryPushState = history.pushState
    // const rawHistoryReplaceState = history.replaceState

    this.inject?.(iframeWindow!)
    iframeWindow.__XXX__.isMicroApp = true
    iframeWindow.__XXX__.sandbox = this

    // history.pushState = function (data: any, title: string, url?: string): void {
    //   const ignoreFlag = url === undefined
    //   rawHistoryPushState.call(history, data, title, ignoreFlag ? undefined : url)
    //   if (ignoreFlag || !isActive()) return
    //   syncUrlToWindow(iframeWindow, name)
    // }
    // history.replaceState = function (data: any, title: string, url?: string): void {
    //   const ignoreFlag = url === undefined
    //   rawHistoryReplaceState.call(history, data, title, ignoreFlag ? undefined : url)
    //   if (ignoreFlag || !isActive()) return
    //   syncUrlToWindow(iframeWindow, name)
    // }
  }

  async generatorIframeApp(url: string) {
    return new Promise((resolve, reject) => {
      this.log('generate iframe DOM independent')
      const iframe: HTMLIFrameElement = loadIframe(url, this.name)
      this.iframe = iframe as SandboxIframe

      iframe.onload = () => {
        this.log(`iframe [${iframe.name}] [${iframe.src}] is onload`)
        this.iframeOnLoadCallback?.()
        resolve(iframe)
      }
      iframe.onerror = function (err) {
        reject(err)
      }
    })
  }

  log(text: string) {
    log(text, this.name)
  }
}

export default forwardRef(function SandboxEntry(props: Pick<SandboxOptions, 'name'>, ref: any) {
  const cls = `root-${props.name}`
  const refContainer = useRef(null)
  const [appStarted, setAppStarted] = useState(false)

  const sandbox: Sandbox | undefined = useMemo(() => {
    return getSandbox(props.name) ?? new Sandbox(props as SandboxOptions)
  }, [props.name])

  useImperativeHandle(ref, () => ({
    getSandbox: () => sandbox
  }))

  useEffect(() => {
    if (refContainer.current) {
      sandbox.iframeOnLoadCallback = () => {
        setAppStarted(true)
        sandbox.log('iframeOnLoadCallback in entry component is called')
      }
      sandbox.startApp({ el: refContainer.current })
    }
    return () => {
      // 隐藏应用
      sandbox?.aliveHidden()
      sandbox.log('component unmounted')
    }
  }, [sandbox])

  return (
    <div
      ref={refContainer}
      className={cls}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto'
      }}>
      {/* @ts-ignore */}
      {appStarted ? null : <XLoading.App style={{ zIndex: 9999 }} />}
    </div>
  )
})

export function preloadApp(props: SandboxOptions) {
  const sandbox = getSandbox(props.name) ?? new Sandbox(props)
  sandbox.preload()
}

// 完全卸载应用
// 清除所有内存
export function destroyApp() {}

// 清除应用与主项目之间的关联，不卸载资源
// 激活时重新做关联即可
export function deactivateApp(appName: string | string[]) {
  const nameArr = Array.isArray(appName) ? appName : [appName]
  nameArr.forEach(name => {
    const sandbox = getSandbox(name)
    if (sandbox) {
      sandbox.deactivated()
    } else {
      console.warn(`[sandbox]: deactivate app name ${name} isn\`t found, maybe not construct.`)
    }
  })
}
