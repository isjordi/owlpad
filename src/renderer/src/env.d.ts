/// <reference types="vite/client" />
import type { OwlPadAPI } from '../../shared/types'

declare global {
  interface Window {
    owlpad: OwlPadAPI
  }
}

export {}
