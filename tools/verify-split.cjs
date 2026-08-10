'use strict';
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(__dirname, 'split-manifest.json');
const WORKER_MANIFEST = path.join(__dirname, 'worker-manifest.json');

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function readWorkerManifest() {
  return JSON.parse(fs.readFileSync(WORKER_MANIFEST, 'utf8'));
}

module.exports = { readManifest, readWorkerManifest };
