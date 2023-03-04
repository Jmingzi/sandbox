import { Sandbox } from './index'
import { TEMPLATE_FLAG, TEMPLATE_FLAG_VALUE } from './constant'

export function checkUrlCrossOrigin(url: string) {
  const { protocol, host } = window.location
  const { protocol: protocol2, host: host2 } = new URL(url)
  return protocol + host !== protocol2 + host2
}

export function getSandbox(name: string) {
  return window.__XXX__?.sandboxCache?.get(name)
}

export function setSandboxCache(name: string, sandbox: Sandbox) {
  return window.__XXX__?.sandboxCache?.set(name, sandbox)
}

export function resetUrlForRefresh(url: string, name: string) {
  const windowUrl = new URL(window.location.href)
  const appIdUrl = windowUrl.searchParams.get(name) as string

  if (!appIdUrl) {
    return url
  }
  log('reset url for refresh', name)
  const iframeUrl = new URL(url)
  const { protocol, host } = iframeUrl
  return `${protocol}//${host}${appIdUrl}`
}

export function syncAppSizeToIframe(el: HTMLDivElement, iframe: HTMLIFrameElement) {
  // console.log('[sandbox]: resize iframe')
  // 此时 el 的 display=none，无法直接获取宽高
  // todo 假设他的父容器内没有其他内容
  // @ts-ignore
  const { width, height } = el.parentNode.getBoundingClientRect()
  iframe.style.setProperty('width', `${width}px`)
  iframe.style.setProperty('height', `${height}px`)
}

export function syncAppPlaceholderStyleToIframe(el: HTMLDivElement, iframe: HTMLIFrameElement) {
  log('sync app placeholder style to iframe', iframe.contentWindow?.__XXX__.sandbox?.name)
  // console.log(el, el.getBoundingClientRect())
  const { top, left, width, height, right } = el.getBoundingClientRect()
  const defaultStyle = `position:absolute;top:${top}px;left:${left}px;right:${right}px;width:${width}px;height:${height}px;`

  const getStyle = (str: string) => {
    const res: { [k: string]: string } = {}
    str
      .split(';')
      .filter(Boolean)
      .forEach(item => {
        const [k, v] = item.split(':')
        res[k.trim()] = v.trim()
      })
    return res
  }
  const styleToCss = (obj: { [k: string]: string }) => {
    return Object.keys(obj).reduce((res, k) => `${res}${k}:${obj[k]};`, '')
  }

  // 同步 class
  el.classList.forEach(k => {
    if (!iframe.classList.contains(k)) {
      iframe.classList.add(k)
    }
  })

  // 同步 style
  const iframeStyleObj = getStyle(iframe.style.cssText)
  const elStyleObj = getStyle(el.style.cssText)
  const whiteKey = ['top', 'left', 'bottom', 'right', 'width', 'height', 'display']
  Object.keys(elStyleObj).forEach(k => {
    if (!whiteKey.includes(k)) {
      iframeStyleObj[k] = elStyleObj[k]
    }
  })
  iframe.style.cssText = styleToCss(iframeStyleObj) + defaultStyle
}

type ITag = 'script' | 'link' | 'style'
export type HTMLTag = {
  tag: ITag
  attrs: { [k: string]: string }
  content?: string
}
export type HTMLLoaderOption = {
  scripts: HTMLTag[]
  links: HTMLTag[]
  styles: HTMLTag[]
}

/** 解析单行 Tag */
const parseOneTag = (str: string) => {
  const result: HTMLTag = {
    tag: (str.match(/<(\w+?)[> ]/)?.[1] as ITag) || 'style',
    attrs: {}
  }
  // eslint-disable-next-line
  str.replace(/ ([a-zA-Z\-]+)(=".*?")?/g, (all, p1, p2) => {
    // 未书写属性值的赋值为 true
    result.attrs[p1] = p2 ? p2.match(/"(.*?)"/)[1] : true
    return all
  })
  return result
}

const scriptReg = /(<script[\s\S]*?>([\s\S]*?)<\/script>)/g
const styleReg = /(<style[\s\S]*?>([\s\S]*?)<\/style>)/g
const linkReg = /(<link[\s\S]*?href="(.*?)"[\s\S]*?>)/g

export async function parseHTML(
  url: string,
  htmlLoader?: (htmlNode: HTMLLoaderOption) => HTMLLoaderOption
) {
  let html = await window.fetch(url).then(res => res.text())
  let scripts: HTMLTag[] = []
  let links: HTMLTag[] = []
  let styles: HTMLTag[] = []

  html = html
    // 提取 script
    .replace(scriptReg, (all, p1, p2) => {
      if (p2.trim()) {
        // 匹配含内容的 script
        const res = parseOneTag(all.replace(p2, '').trim())
        res.content = p2.trim()
        scripts.push(res)
      } else {
        scripts.push(parseOneTag(all))
      }
      return all.replace(p1, '<!-- replaced by sandbox, script -->')
    })
    // 提取 style
    .replace(styleReg, (all, p1, p2) => {
      if (p2.trim()) {
        // 匹配含内容的 style
        const res = parseOneTag(all.replace(p2, '').trim())
        res.content = p2.trim()
        styles.push(res)
      }
      return all.replace(p1, '<!-- replaced by sandbox, style -->')
    })
    // 提取 link
    .replace(linkReg, (all, p1) => {
      const res = parseOneTag(all)
      // rel stylesheet
      if (res.attrs.rel === 'stylesheet') {
        links.push(res)
        return all.replace(p1, '<!-- replaced by sandbox, link href -->')
      }
      return all
    })

  const loaderResult = htmlLoader?.({ scripts, links, styles })
  if (loaderResult) {
    scripts = loaderResult.scripts
    links = loaderResult.links
    styles = loaderResult.styles
  }

  return {
    html,
    scripts,
    links,
    styles
  }
}

export function anchorElementGenerator(url: string): HTMLAnchorElement {
  const element = window.document.createElement('a')
  element.href = url
  // eslint-disable-next-line no-self-assign
  element.href = element.href // fuck ie
  return element
}

export function setAttrsToElement(element: HTMLElement, attrs: { [key: string]: any }) {
  Object.keys(attrs).forEach(name => {
    element.setAttribute(name, attrs[name] ?? true)
  })
}

export function addScriptToBody(item: HTMLTag, doc: Document) {
  const script = doc.createElement('script')
  setAttrsToElement(script, item.attrs)
  // 确保顺序执行
  script.async = false
  if (item.content) {
    script.innerHTML = item.content
  }
  appendChild(doc.body, script)
}

export function log(text: string, name?: string) {
  const color = ['color:green;', 'color:inherit;', 'color:inherit;']
  if (name) {
    color.splice(2, 0, 'color:yellow;')
  }
  console.log(`%c[sandbox]:${name ? `%c app %c[${name}]%c` : ''} ${text}`, ...color)
}

export function appendChild(parentNode: HTMLHeadElement | HTMLBodyElement, node: HTMLElement) {
  node.setAttribute(TEMPLATE_FLAG, TEMPLATE_FLAG_VALUE)
  parentNode.appendChild(node)
}
