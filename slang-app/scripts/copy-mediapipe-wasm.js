#!/usr/bin/env node
// Run after npm install to keep public/mediapipe-wasm/ in sync with installed version.
// Usage: node scripts/copy-mediapipe-wasm.js
import { cpSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src  = resolve(__dirname, '../node_modules/@mediapipe/tasks-vision/wasm');
const dest = resolve(__dirname, '../public/mediapipe-wasm');

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('✓ MediaPipe WASM files copied to public/mediapipe-wasm/');
