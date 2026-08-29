import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = __dirname
const reactRoot = path.join(webRoot, 'node_modules/react')
const reactDomRoot = path.join(webRoot, 'node_modules/react-dom')

const REACT_ALIASES = [
  { find: 'react-dom/client', replacement: path.join(reactDomRoot, 'client.js') },
  { find: 'react/jsx-runtime', replacement: path.join(reactRoot, 'jsx-runtime.js') },
  { find: 'react/jsx-dev-runtime', replacement: path.join(reactRoot, 'jsx-dev-runtime.js') },
  { find: 'react-dom', replacement: reactDomRoot },
  { find: 'react', replacement: reactRoot },
]

const REACT_PACKAGES = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]

function forceSingleReact() {
  const mappings = Object.fromEntries(
    REACT_ALIASES.map(({ find, replacement }) => [find, replacement])
  )

  return {
    name: 'force-single-react',
    enforce: 'pre',
    resolveId(source) {
      return mappings[source] ?? null
    },
  }
}

export default defineConfig({
  root: webRoot,
  plugins: [forceSingleReact(), react()],
  envDir: path.resolve(webRoot, '..'),
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  resolve: {
    dedupe: REACT_PACKAGES,
    alias: REACT_ALIASES,
  },
  optimizeDeps: {
    include: [
      ...REACT_PACKAGES,
      'antd',
      '@ant-design/icons',
      'react-router-dom',
      'recharts',
      'dayjs',
    ],
  },
  server: {
    host: true,
    allowedHosts: true,
    fs: {
      strict: true,
      allow: [webRoot],
    },
  },
})
