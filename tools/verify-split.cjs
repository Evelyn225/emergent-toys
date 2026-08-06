'use strict';
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(__dirname, 'split-manifest.json');

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

module.exports = { readManifest };
