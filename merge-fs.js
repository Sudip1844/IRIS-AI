const fs = require('fs');
const files = [
  'src/main/logic/dir-load.ts',
  'src/main/logic/file-open.ts',
  'src/main/logic/file-ops.ts',
  'src/main/logic/file-read.ts',
  'src/main/logic/file-search.ts',
  'src/main/logic/file-write.ts'
];
let body = '';
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/^import .*$/gm, '');
  content = content.replace(/^export default function \w+\(.*\) \{$/gm, '');
  content = content.replace(/\}[ \n\r]*$/, '');
  body += content + '\n';
}

const newContent = `import { IpcMain, app, shell } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import Groq from 'groq-sdk'
import { execSync } from 'child_process'
import { classifyFileOpen, classifyFileWrite, approve } from '../security/SecurityGateway'

export default function registerFSServices(ipcMain: IpcMain) {
${body}
}
`;
fs.writeFileSync('src/main/services/fs-service.ts', newContent);
