import { defineConfig, loadEnv } from 'vite'

const BACKEND_USER = 'Murrr228'
const BACKEND_TARGET = 'http://localhost:8082'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const password = env.HTTP_SERVER_PASSWORD ?? ''
  const authHeader = 'Basic ' + Buffer.from(`${BACKEND_USER}:${password}`).toString('base64')

  return {
    server: {
      proxy: {
        '/url': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          headers: {
            Authorization: authHeader,
          },
        },
      },
    },
  }
})
