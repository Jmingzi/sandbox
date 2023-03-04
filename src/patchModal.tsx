import React, { useEffect, useMemo } from 'react'
import { Modal, version } from 'antd'

const isAntd3 = version.startsWith('3')
const patchModalOffsetWrapClassName = 'patch-modal-wrap'
const isMicroApp = window.__XXX__?.isMicroApp

function getSandboxIframe() {
  return window.__XXX__?.sandbox?.iframe
}

function getRandom() {
  return Math.ceil(Math.random() * 1000000)
}

// todo mask 点击，在 antd4 版本默认会关闭弹窗
/** 处理主项目遮罩 */
function toggleMainAppMask(show: boolean, modalId: string) {
  const cls = `patch-modal-mask__${modalId}`
  const antdModalMaskBackgroundColor = 'rgba(0,0,0,.45)'

  const document = window.top!.document
  let mainAppMask = document.querySelector(`.${cls}`)
  mainAppMask?.childNodes.forEach(div => {
    ;(div as HTMLDivElement).style.setProperty('background', '')
  })
  mainAppMask?.remove()

  function _addMask() {
    mainAppMask = document.createElement('div')
    mainAppMask.classList.add(cls)
    const maskCommonStyle = 'position:absolute;z-index:99999;'

    // 左侧遮罩
    let leftMask: HTMLDivElement | undefined
    // @ts-ignore
    const rootIframe = getSandboxIframe()
    const rootIframeLeft = rootIframe?.style?.left
    if (rootIframeLeft && parseInt(rootIframeLeft)) {
      leftMask = document.createElement('div')
      leftMask.style.cssText = `${maskCommonStyle}left:0;top:0;width:${rootIframeLeft};height:100vh;`
      leftMask!.style.setProperty('background', antdModalMaskBackgroundColor)
    }
    if (leftMask) {
      mainAppMask.appendChild(leftMask)
    }

    // 顶部遮罩
    let topMask: HTMLDivElement | undefined
    // @ts-ignore
    const rootIframeTop = rootIframe?.style?.top
    if (rootIframeTop && parseInt(rootIframeTop)) {
      topMask = document.createElement('div')
      const width = leftMask ? `calc(100% - ${rootIframeLeft})` : '100%'
      topMask.style.cssText = `${maskCommonStyle}right:0;top:0;width:${width};height:${rootIframeTop};`
      topMask!.style.setProperty('background', antdModalMaskBackgroundColor)
    }
    if (topMask) {
      mainAppMask.appendChild(topMask)
    }

    // 右侧遮罩
    let rightMask: HTMLDivElement | undefined
    // @ts-ignore
    const rootIframeRight = rootIframe?.style?.right
    if (rootIframeRight && parseInt(rootIframeRight)) {
      rightMask = document.createElement('div')
      const top = topMask ? rootIframeTop : 0
      const height = topMask ? `calc(100vh - ${rootIframeTop})` : '100vh'
      const width =
        document.body.clientWidth -
        (rootIframeLeft ? parseInt(rootIframeLeft) : 0) -
        parseInt(rootIframe?.style?.width ?? 0)
      rightMask.style.cssText = `${maskCommonStyle}right:0;top:${top};width:${width}px;height:${height};`
      rightMask!.style.setProperty('background', antdModalMaskBackgroundColor)
    }
    if (rightMask) {
      mainAppMask.appendChild(rightMask)
    }

    if (mainAppMask.childNodes.length) {
      document.body.appendChild(mainAppMask)
    }
  }

  if (show) {
    _addMask()
  }
}

/** 处理弹窗的位置 */
function patchModalOffset() {
  const id = 'patch-modal-offset'
  let style = document.getElementById(id)
  if (!style) {
    const rootIframe = getSandboxIframe()
    const rootIframeLeft = parseInt(rootIframe?.style?.left ?? '0')
    style = document.createElement('style')
    style.id = id
    const antMessageStyleContent = `.ant-message .ant-message-notice-content { transform: translateX(${
      -rootIframeLeft / 2
    }px) }`
    const styleContent = `{ transform:translateX(${
      -rootIframeLeft / 2
    }px);transform-origin:0!important; } ${antMessageStyleContent}`
    // antd 3 没有 wrapClassName，所以样式要作用于 className
    style.innerHTML = isAntd3
      ? `.${patchModalOffsetWrapClassName} ${styleContent}`
      : `.${patchModalOffsetWrapClassName} .ant-modal ${styleContent}`

    document.body.appendChild(style)
  }
}

/** 处理方法调用的遮罩 */
function patchModalMethod(name: 'confirm' | 'success' | 'info' | 'error' | 'warning') {
  return (props: any) => {
    const id = `patch-modal-${name}__${getRandom()}`
    toggleMainAppMask(true, id)
    const patchCallback =
      (name: 'onOk' | 'onCancel') =>
      (...args: any) => {
        const res = props[name]?.apply(null, args)
        if (res instanceof Promise) {
          return res.then(r => {
            toggleMainAppMask(false, id)
            return r
          })
        }
        toggleMainAppMask(false, id)
      }
    patchModalOffset()

    return Modal[name]({
      ...props,
      onOk: patchCallback('onOk'),
      onCancel: patchCallback('onCancel'),
      /** antd3 源码此处传空还是会被赋值 */
      transitionName: '',
      maskTransitionName: '',
      [isAntd3 ? 'className' : 'wrapClassName']: patchModalOffsetWrapClassName
    })
  }
}

const ProxyModal = (props: any) => {
  const cls = useMemo(() => `patch-modal-${getRandom()}`, [])

  const open = isAntd3 ? props.visible : props.open
  const proxyModal = isMicroApp && props.mask !== false

  useEffect(() => {
    if (proxyModal) {
      toggleMainAppMask(open, cls)
    }
  }, [open])

  if (!proxyModal) {
    return <Modal {...props} />
  }

  patchModalOffset()
  return (
    <Modal
      {...props}
      className={cls}
      wrapClassName={patchModalOffsetWrapClassName}
      transitionName=""
      maskTransitionName=""
    />
  )
}

if (isMicroApp) {
  ProxyModal.confirm = patchModalMethod('confirm')
  ProxyModal.success = patchModalMethod('success')
  ProxyModal.info = patchModalMethod('info')
  ProxyModal.error = patchModalMethod('error')
  ProxyModal.warning = ProxyModal.warn = patchModalMethod('warning')
  ProxyModal.defaultProps = Modal.defaultProps
  ProxyModal.destroyAll = Modal.destroyAll
  ProxyModal.propTypes = Modal.propTypes

  // @ts-ignore
  const antd = window.antd
  if (antd && !antd.hasPatched) {
    // @ts-ignore
    window.antd = {
      ...antd,
      // 覆盖
      Modal: ProxyModal,
      hasPatched: true
    }
    console.warn('[sandbox]: antd.Modal has been replaced with patchModal')
  }
}

export default ProxyModal
