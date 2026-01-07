#!/usr/bin/env node

const path = require('path');

const cliPath = path.join(__dirname, '..', 'dist', 'src', 'cli.js');
require(cliPath);
