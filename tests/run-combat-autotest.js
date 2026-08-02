'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const withRules = process.argv.includes('--with-rules');
const startedAt = Date.now();

const checks = [
  ['Очередь действий игрока', 'tests/gameplay-operation-outbox.test.js'],
  ['Экипировка и оружие', 'tests/equipment-rules.test.js'],
  ['Статусы, броски и ограничения боя', 'tests/status-combat-sync.test.js'],
  ['Ручные спасброски при 0 HP', 'tests/death-save-ui.test.js'],
  ['Синхронизация листа персонажа', 'tests/session-character-sheet.test.js'],
  ['Сцена и перенос её состояния', 'tests/scene-transfer.test.js'],
  ['Полный сценарий ГМ + игрок', 'tests/two-client-combat.test.js']
];

function seconds(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)} с`;
}

function runNodeFile(label, relativeFile) {
  const absoluteFile = path.join(root, relativeFile);
  if (!fs.existsSync(absoluteFile)) {
    throw new Error(`Не найден тест: ${relativeFile}`);
  }
  const stageStartedAt = Date.now();
  console.log(`\n[БОЙ] ${label}`);
  const result = spawnSync(process.execPath, [absoluteFile], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label}: тест завершился с кодом ${result.status}`);
  }
  console.log(`[OK] ${label} — ${seconds(Date.now() - stageStartedAt)}`);
}

function runRulesMatrix() {
  const firebaseCli = path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
  const rulesTest = path.join(root, 'tests/firebase-rules.emulator.mjs');
  if (!fs.existsSync(firebaseCli)) {
    throw new Error('Не установлен локальный firebase-tools. Выполните npm install.');
  }
  const nodeDirectory = path.dirname(process.execPath);
  const javaDirectories = [
    '/opt/homebrew/opt/openjdk@21/bin',
    '/opt/homebrew/opt/openjdk/bin',
    '/usr/local/opt/openjdk@21/bin'
  ].filter((directory) => fs.existsSync(path.join(directory, 'java')));
  const childEnv = Object.assign({}, process.env, {
    PATH: [nodeDirectory].concat(javaDirectories, process.env.PATH || '').join(':'),
    FIREBASE_CLI_DISABLE_UPDATE_CHECK: '1'
  });
  const command = `"${process.execPath}" "${rulesTest}"`;
  const stageStartedAt = Date.now();
  console.log('\n[FIREBASE] Матрица прав ГМ и игрока');
  const result = spawnSync(process.execPath, [
    firebaseCli,
    'emulators:exec',
    '--project', 'zargota-vtt-rules-test',
    '--only', 'database',
    command
  ], {
    cwd: root,
    env: childEnv,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Firebase Rules Emulator завершился с кодом ${result.status}`);
  }
  console.log(`[OK] Firebase Rules — ${seconds(Date.now() - stageStartedAt)}`);
}

try {
  console.log('=== Автотест боя Зарготы: ГМ + игрок ===');
  checks.forEach(([label, file]) => runNodeFile(label, file));
  if (withRules) runRulesMatrix();
  console.log(`\n=== ГОТОВО: ${checks.length}${withRules ? ' + Firebase Rules' : ''} проверок за ${seconds(Date.now() - startedAt)} ===`);
} catch (error) {
  console.error(`\n=== ОШИБКА АВТОТЕСТА ===\n${error && error.stack ? error.stack : error}`);
  process.exitCode = 1;
}
