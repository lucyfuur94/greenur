/// <reference types="vite/client" />

declare global {
  namespace NodeJS {
    interface Timeout extends Timer {}
  }
}
