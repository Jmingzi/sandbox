import { Sandbox } from './index'
import {
  addScriptToBody,
  anchorElementGenerator,
  setAttrsToElement,
  appendChild,
  log
} from './utils'
import { APP_ACTIVE_SCRIPT_CLASS, ROOT_ID, TEMPLATE_FLAG, TEMPLATE_FLAG_VALUE } from './constant'

function initIframeDOM(iframeWindow: Window, templateResult: Sandbox['templateResult']) {
  const sandbox = iframeWindow.__XXX__.sandbox
  const doc = iframeWindow.document

  const newDoc = window.document.implementation.createHTMLDocument('')
  const newDocumentElement = doc.importNode(newDoc.documentElement, true)
  /** 有一定概率在执行 stop 后，iframe 的 document 还未创建 */
  if (!doc.documentElement) {
    // 创建新的 documentElement
    doc.appendChild(newDocumentElement)
  } else {
    doc.replaceChild(newDocumentElement, doc.documentElement)
  }

  // todo 手动创建 root
  const div = doc.createElement('div')
  div.id = ROOT_ID
  appendChild(doc.body, div)
  sandbox?.log('3.initIframeDOM with div#root')

  /** 处理资源的相对路径 */
  initBase(iframeWindow, sandbox!.entry.js)
  // 插入模版内容
  templateResult!.links.forEach(item => {
    const link = doc.createElement('link')
    setAttrsToElement(link, item.attrs)
    appendChild(doc.head, link)
  })
  templateResult!.styles.forEach(item => {
    const style = doc.createElement('style')
    setAttrsToElement(style, item.attrs)
    if (item.content) {
      style.innerText = item.content
    }
    appendChild(doc.head, style)
  })
  templateResult!.scripts.forEach(item => {
    addScriptToBody(item, doc)
  })
}

export function resetIframeDOM(iframeWindow: Window) {
  const { head, body } = iframeWindow.document
  Array.from(head.childNodes).forEach(node => {
    if ((node as HTMLElement).getAttribute(TEMPLATE_FLAG) !== TEMPLATE_FLAG_VALUE) {
      node.remove()
    }
  })
  Array.from(body.childNodes).forEach(node => {
    if ((node as HTMLElement).getAttribute(TEMPLATE_FLAG) !== TEMPLATE_FLAG_VALUE) {
      node.remove()
    }
  })
  const rootEl = iframeWindow.document.getElementById(ROOT_ID)
  // 重置 root
  // @ts-ignore
  iframeWindow.ReactDOM?.unmountComponentAtNode(rootEl)
  // @ts-ignore
  if (!iframeWindow.ReactDOM) {
    throw new Error(
      '[xapp-sandbox]: 卸载应用时，子应用的 window.ReactDOM 不存在，无法卸载路由，请提供卸载方法 window.__XAPP_UNMOUNT__ 进行路由卸载'
    )
  }
  // 移除子应用 js
  body.querySelectorAll(`.${APP_ACTIVE_SCRIPT_CLASS}`).forEach(node => {
    node.remove()
  })
}

// 防止运行主应用的js代码，给子应用带来很多副作用
export function stopIframeLoading(iframeWindow: Window) {
  const oldDoc = iframeWindow.document
  return new Promise<void>(resolve => {
    function loop() {
      const _ = () => {
        let newDoc = null
        try {
          newDoc = iframeWindow.document
        } catch (err) {
          newDoc = null
        }
        // wait for document ready
        // eslint-disable-next-line eqeqeq
        if (!newDoc?.documentElement || !newDoc?.head || newDoc == oldDoc) {
          loop()
        } else {
          iframeWindow.stop ? iframeWindow.stop() : iframeWindow.document.execCommand('Stop') // IE 浏览器
          const sandbox = iframeWindow.__XXX__.sandbox
          sandbox?.log('2.Stop() load iframe with main app, prepare initIframeDOM')
          initIframeDOM(iframeWindow, sandbox!.templateResult)
          /**
           * 如果有同步优先同步，非同步从url读取
           */
          // if (!isMatchSyncQueryById(iframeWindow.__WUJIE.id)) {
          //   iframeWindow.history.replaceState(null, "", mainHostPath + appRoutePath)
          // }
          resolve()
        }
      }
      setTimeout(_, 1)
    }
    loop()
  })
}

export const loadIframe = (iframeSrc: string, name: string) => {
  let iframe: HTMLIFrameElement | null = document.querySelector(`iframe[name="${name}"]`)
  if (iframe) {
    console.warn(`[sandbox]: [${name}] app duplicate generate.`)
    iframe.remove()
  }

  iframe = document.createElement('iframe')
  iframe.src = iframeSrc
  iframe.name = name
  iframe.style.cssText = 'border:none;width:100%;height:100%;display:none;'

  window.document.body.appendChild(iframe)
  return iframe
}

// 只处理 hash 同步
export function syncUrlToWindow(iframeWindow: Window, name: string): void {
  const { pathname, search, hash } = iframeWindow.location
  // const curIframeUrl = pathname + search + hash
  const windowUrl = new URL(window.location.href)
  // if (windowUrl.searchParams.has(name)) {
  //   windowUrl.searchParams.set(name, curIframeUrl)
  // } else {
  //   windowUrl.searchParams.append(name, curIframeUrl)
  // }
  // 同步 hash
  windowUrl.hash = hash

  if (windowUrl.toString() !== window.location.href) {
    log('from watch sync iframe url to window', name)
    // window.history.replaceState(null, '', windowUrl.toString())
    window.location.hash = hash
  }
}

export function syncUrlToIframe(iframeWindow: Window, name: string): void {
  const { hash } = iframeWindow.location
  // const preAppRoutePath = pathname + search + hash
  const { hash: winHash } = window.location

  // // 只在浏览器刷新或者第一次渲染时同步
  // const windowUrl = new URL(window.location.href)
  // const appIdUrl = windowUrl.searchParams.has(name)
  //   ? (windowUrl.searchParams.get(name) as string)
  //   : pathname + search + hash

  // // 排除href跳转情况
  // const newAppRoutePath = (/^http/.test(appIdUrl) ? null : appIdUrl) ?? preAppRoutePath

  // if (preAppRoutePath !== newAppRoutePath) {
  //   console.log(`[sandbox]: sync url to [${name}] iframe`, appIdUrl)
  //   iframeWindow.history.replaceState(null, '', newAppRoutePath)
  // }
  if (hash !== winHash) {
    log(`sync window url to iframe: ${winHash}`, name)
    iframeWindow.location.hash = winHash
  }
}

// 监听 window 上的 hash 路由变化同步给对应的 iframe
export function watchWindowHashChange(iframeWindow: Window) {
  const { hash } = iframeWindow.location

  const callback = (e: HashChangeEvent) => {
    const sandbox = iframeWindow.__XXX__.sandbox
    if (!sandbox?.isAliveDisplay) {
      return
    }

    const newHash = new URL(e.newURL).hash
    if (hash !== newHash) {
      /** iframeWindow.history.pushState(null, '', newAppRoutePath) 不能触发 hashchange */
      const newHashAppName = newHash.split('/')[1]
      // 匹配应用
      if (newHashAppName === sandbox?.name) {
        sandbox?.log(`from watch emit hash change to [${sandbox?.name}] iframe: ${newHash}`)
        // emitHashChange?.(newHash.substring(1))
        iframeWindow.location.hash = newHash
      }
    }
  }
  window.addEventListener('hashchange', callback)
}

export function watchIframeHashChange(iframeWindow: Window) {
  iframeWindow.addEventListener('hashchange', () => {
    const sandbox = iframeWindow.__XXX__.sandbox
    if (!sandbox?.isAliveDisplay) {
      return
    }
    syncUrlToWindow(iframeWindow, sandbox.name)
  })
}

export function initBase(iframeWindow: Window, url: string): void {
  const iframeDocument = iframeWindow.document
  const baseElement = iframeDocument.createElement('base')
  const iframeUrlElement = anchorElementGenerator(iframeWindow.location.href)
  const appUrlElement = anchorElementGenerator(url)
  baseElement.setAttribute(
    'href',
    appUrlElement.protocol + '//' + appUrlElement.host + iframeUrlElement.pathname
  )
  appendChild(iframeDocument.head, baseElement)
}
