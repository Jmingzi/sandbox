import { Sandbox } from './Sandbox'

declare global {
  interface Window {
    __XXX__: {
      sandboxCache?: Map<string, Sandbox>
      sandbox?: Sandbox
      isMicroApp?: boolean
    }
    __XXX_UNMOUNT__?: () => void
  }
}
