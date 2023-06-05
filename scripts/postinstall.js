#!/usr/bin/env node
/* eslint-disable max-len */
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import {join} from 'path';

const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = dirname(FILENAME);

console.log(`CharmMM is installed. The config file example is ${join(DIRNAME, 'config.yml.example')}`);
console.log('Modify the example to create a config file.');
