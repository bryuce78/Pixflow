/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PIXFLOW_DISABLE_LOGIN?: string
  readonly VITE_PIXFLOW_DEV_AUTO_LOGIN?: string
  readonly VITE_PIXFLOW_DEV_AUTO_LOGIN_EMAIL?: string
  readonly VITE_PIXFLOW_DEV_AUTO_LOGIN_PASSWORD?: string
  readonly VITE_PIXFLOW_DEV_AUTH_BYPASS?: string
  readonly VITE_PIXFLOW_FRONTEND_TELEMETRY_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
