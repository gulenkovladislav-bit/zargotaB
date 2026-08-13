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
  ['Завершение действий без пустых состояний', 'tests/combat-action-dead-end.test.js'],
  ['Ручные спасброски при 0 HP', 'tests/death-save-ui.test.js'],
  ['Решение судьбы героев и существ', 'tests/combat-fate-decision.test.js'],
  ['Пропуск участников по инициативе', 'tests/combat-round-skip.test.js'],
  ['Визуальное меню спасброска', 'tests/combat-save-visual.test.js'],
  ['Плавное появление меню тулбара', 'tests/combat-popup-position.test.js'],
  ['Правая кнопка без браузерного меню на поле', 'tests/game-context-menu.test.js'],
  ['Сражён и личная предсмертная виньетка', 'tests/downed-player-vignette.test.js'],
  ['ГМ управляет героем текущего хода', 'tests/gm-current-player-routing.test.js'],
  ['Герои кампании доступны в подготовке боя', 'tests/workshop-campaign-heroes.test.js'],
  ['Мастерская использует пакетные кубики', 'tests/single-client-combat-lab.test.js'],
  ['Ручной d20 ГМа стартует из точки отпускания', 'tests/gm-creature-hit-drag.test.js'],
  ['Боевой drag создаёт ровно один бросок', 'tests/combat-physical-drag.test.js'],
  ['Кубики не дублируются при сетевом подтверждении', 'tests/dice-visual-dedup.test.js'],
  ['Точный результат ГМа для всего пакета кубиков', 'tests/gm-forced-dice-batch.test.js'],
  ['До 12 кубиков и последовательный подсчёт', 'tests/dice-batch-sequence.test.js'],
  ['Плавный полёт и приземление кубиков', 'tests/dice-flight-continuity.test.js'],
  ['Звук и частицы результата кубиков', 'tests/dice-result-fx.test.js'],
  ['Реальный выбор звука по исходу d20', 'tests/d20-outcome-audio-runtime.test.js'],
  ['Локальные MP3 в file-режиме Мастерской', 'tests/file-audio-sample.test.js'],
  ['Один авторский звук для всех бросков', 'tests/all-dice-sound-routing.test.js'],
  ['Лист героя и видимость HP', 'tests/character-sheet-hp-visibility.test.js'],
  ['Карточка активного участника не обрезается', 'tests/party-card-overflow.test.js'],
  ['Звуки бросков без повторов', 'tests/combat-dice-sound.test.js'],
  ['Маршрутизация звуков live-боя', 'tests/live-combat-sound-routing.test.js'],
  ['Авторские текстуры удара', 'tests/authored-combat-impact.test.js'],
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
