import fs from 'node:fs';
import path from 'node:path';

const output = path.resolve('.next/standalone');
if (!fs.existsSync(path.join(output, 'server.js'))) throw new Error('Standalone server was not generated');
fs.cpSync('public', path.join(output, 'public'), { recursive: true });
fs.cpSync('.next/static', path.join(output, '.next/static'), { recursive: true });
