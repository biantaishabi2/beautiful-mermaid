import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const addon = require('./index.node')
export const echoBuffer = addon.echoBuffer
