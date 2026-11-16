#!/usr/bin/env node
'use strict';
// Operator tool, never included in the website. Uses the SAME save endpoint as its editor.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const D = require('../functions/character-domain');
const ROOT = path.resolve(__dirname, '..');
const collections = new Set(['skills', 'mastery', 'inventoryItems', 'journalEntries']);
const record = v => v && typeof v === 'object' && !Array.isArray(v);
function need(ok, message) { if (!ok) throw Error(message); }
function projectImagePath(value) {
  return typeof value === 'string' && /^(?:images|assets)\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(value) &&
    value.split('/').every(part => part && part !== '.' && part !== '..');
}

function mergePatch(character, patch) {
  need(record(patch) && patch.characterId != null && typeof patch.campaignKey === 'string' && patch.campaignKey, 'Specify characterId AND campaignKey');
  need(String(character.id) === String(patch.characterId) && character.campaignKey === patch.campaignKey, 'Character identity mismatch');
  const hasPortrait = Object.hasOwn(patch, 'portrait');
  const operations = patch.operations === undefined && hasPortrait ? [] : patch.operations;
  need(Array.isArray(operations) && operations.length <= 100 && (operations.length > 0 || hasPortrait), 'Invalid operations');
  const next = structuredClone(character);
  if (hasPortrait) {
    const change = patch.portrait;
    need(record(change) && Object.keys(change).length === 2 && projectImagePath(change.from) && projectImagePath(change.to), 'Portrait needs from/to project-relative image paths');
    need(next.portrait === change.from || next.portrait === change.to, 'Portrait changed; inspect the current choice before retrying');
    // A rerun never clears focus or a later explicit choice of the same image.
    if (next.portrait !== change.to) {
      need(!next.portraitThumb && !next.portraitChoice, 'Personal portrait or explicit choice must be preserved');
      next.portrait = change.to;
      delete next.portraitFocusX;
      delete next.portraitFocusY;
    }
  }
  for (const op of operations) {
    need(record(op) && collections.has(op.collection) && record(op.match) && record(op.set), 'Invalid entry operation');
    const keys = Object.keys(op.match), key = keys[0];
    need(keys.length === 1 && ['id', 'name'].includes(key) && String(op.match[key] ?? '').length > 0, 'Match one stable id or exact legacy name');
    need(!Object.hasOwn(op.set, 'id'), 'Entry identity cannot be changed');
    const entries = next[op.collection] ?? [];
    need(Array.isArray(entries), 'Collection is not an array');
    const matches = entries.map((entry, i) => record(entry) && String(entry[key]) === String(op.match[key]) ? i : -1).filter(i => i >= 0);
    need(matches.length <= 1, 'Ambiguous entry match');
    if (matches.length) {
      entries[matches[0]] = {...entries[matches[0]], ...op.set};
    } else {
      need(key === 'id' && record(op.create), 'Entry missing; creation needs a stable id and create defaults');
      need(op.create.id == null || String(op.create.id) === String(op.match.id), 'Create identity mismatch');
      const entry = {...op.create, ...op.set, id: op.match.id};
      need(!entries.some(e => record(e) && e.name && e.name === entry.name), 'An entry with this name already exists; inspect it before adding');
      entries.push(entry);
    }
    next[op.collection] = entries;
  }
  return D.clean(next);
}

async function ownedSheets(t) {
  const membership = await t.list();
  const sheets = [];
  for (const [sheetId, role] of Object.entries(membership || {})) {
    if (role !== 'master') continue;
    const state = await t.read(sheetId);
    if (state) sheets.push({sheetId, state, character: JSON.parse(state.characterJson)});
  }
  return sheets;
}

async function applyPatch(t, patch, {write = false, backup} = {}) {
  const matches = (await ownedSheets(t)).filter(s => String(s.character.id) === String(patch.characterId) && s.character.campaignKey === patch.campaignKey);
  need(matches.length === 1, 'Expected exactly one owned sheet matching characterId and campaignKey');
  const {sheetId, state, character} = matches[0];
  const next = mergePatch(character, patch), changes = D.changes(character, next);
  const report = {sheetId, name: character.name, revision: state.revision, changes};
  if (!changes.length) return {...report, status: 'unchanged'};
  if (!write) return {...report, status: 'preview'};
  // Never retry with a stale complete sheet: the server rejects concurrent saves.
  const input = {action: 'save', sheetId, expectedRevision: state.revision,
    operationId: 'operator_' + crypto.randomUUID(), source: 'sheet', character: next};
  if (backup) await backup({sheetId, state, input});
  let saved;
  try { saved = (await t.call(input)).state; }
  catch (error) {
    // A lost response may follow a successful save. Verify its receipt via state,
    // never automatically resubmit or turn an uncertain write into a second edit.
    const observed = await t.read(sheetId).catch(() => null);
    if (!observed || observed.operationId !== input.operationId) throw error;
    saved = observed;
  }
  need(saved && saved.operationId === input.operationId && saved.revision === state.revision + 1 && D.equal(JSON.parse(saved.characterJson), next), 'Save response mismatch');
  const current = await t.read(sheetId);
  const history = await t.history(sheetId);
  const entry = history[String(saved.revision).padStart(12, '0')];
  need(current && current.revision >= saved.revision && entry && entry.actorRole === 'master' && D.equal(JSON.parse(entry.changesJson), changes), 'Save not verified; inspect before retrying');
  if (current.revision === saved.revision) need(current.operationId === saved.operationId && D.equal(JSON.parse(current.characterJson), next), 'Canonical read-back mismatch');
  return {...report, status: 'saved', revision: saved.revision, currentRevision: current.revision};
}

function privatePath(filename) {
  const resolved = path.resolve(filename);
  need(resolved !== ROOT && !resolved.startsWith(ROOT + path.sep), 'Credentials/backups must stay outside the repository');
  return resolved;
}
function privateWrite(filename, data) {
  filename = privatePath(filename);
  fs.mkdirSync(path.dirname(filename), {recursive: true, mode: 0o700});
  const temp = filename + '.' + crypto.randomUUID();
  fs.writeFileSync(temp, JSON.stringify(data), {mode: 0o600, flag: 'wx'});
  fs.renameSync(temp, filename);
}
function privateRead(filename) {
  filename = privatePath(filename);
  const stat = fs.lstatSync(filename);
  need(stat.isFile() && !(stat.mode & 0o077), 'Private file must be a regular file with permissions 0600');
  return fs.readFileSync(filename, 'utf8');
}
function config() {
  // Read the project's public configuration without evaluating browser code.
  const text = fs.readFileSync(path.join(ROOT, 'zargota-network.js'), 'utf8');
  const value = key => { const m = text.match(new RegExp(key + ":\\s*'([^']+)'")); need(m, 'Missing Firebase config'); return m[1]; };
  return {apiKey: value('apiKey'), projectId: value('projectId'), databaseURL: value('databaseURL')};
}
async function request(url, body, headers = {}) {
  let response;
  const form = body instanceof URLSearchParams;
  try { response = await fetch(url, {method: body ? 'POST' : 'GET', headers: {...(body ? {'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json'} : {}), ...headers}, ...(body ? {body: form ? body.toString() : JSON.stringify(body)} : {}), signal: AbortSignal.timeout(30000)}); }
  catch (_) { throw Error('Network request failed (no credentials logged)'); }
  const data = await response.json();
  // Do not print provider errors: they may echo credentials or private payloads.
  if (!response.ok || data.error) {
    const known = ['revision-conflict', 'access-denied', 'invalid-code', 'character-too-large', 'unsafe-character-content', 'invalid-character'];
    const message = known.find(code => String(data.error?.message || '').includes(code));
    throw Error(message || 'Remote request failed HTTP ' + response.status);
  }
  return data;
}
async function connect({session, codeFile}) {
  session = privatePath(session);
  const c = config(), endpoint = 'https://europe-west1-' + c.projectId + '.cloudfunctions.net/characterAccess';
  const identity = (action, data) => request('https://identitytoolkit.googleapis.com/v1/accounts:' + action + '?key=' + c.apiKey, data);
  let token, uid, refreshToken;
  const call = async data => (await request(endpoint, {data}, {Authorization: 'Bearer ' + token})).result;
  if (codeFile) {
    const raw = privateRead(codeFile).trim();
    const code = raw.startsWith('{') ? JSON.parse(raw).code : raw;
    need(typeof code === 'string' && /^ZG[-A-Fa-f0-9\s]+$/.test(code), 'Use the master recovery code file, not the short device PIN');
    const guest = await identity('signUp', {returnSecureToken: true});
    token = guest.idToken;
    try {
      const grant = await call({action: 'login', code});
      const auth = await identity('signInWithCustomToken', {token: grant.token, returnSecureToken: true});
      token = auth.idToken; refreshToken = auth.refreshToken;
      const profile = await identity('lookup', {idToken: token});
      uid = profile.users?.[0]?.localId;
    } finally { await identity('delete', {idToken: guest.idToken}).catch(() => {}); }
  } else {
    need(fs.existsSync(session), 'Operator is not paired yet; use --code-file once. No live data was written.');
    const stored = JSON.parse(privateRead(session));
    need(stored.projectId === c.projectId, 'Session project mismatch');
    const auth = await request('https://securetoken.googleapis.com/v1/token?key=' + c.apiKey, new URLSearchParams({grant_type: 'refresh_token', refresh_token: stored.refreshToken}));
    token = auth.id_token; uid = auth.user_id; refreshToken = auth.refresh_token;
    need(uid === stored.uid, 'Session identity mismatch');
  }
  const account = await call({action: 'account'});
  need(account.role === 'admin' && account.uid === uid, 'Operator requires the existing master account');
  privateWrite(session, {projectId: c.projectId, uid, refreshToken});
  const read = p => request(c.databaseURL + '/' + p + '.json?auth=' + encodeURIComponent(token));
  return {call, list: () => read('persistentCharacterUsers/' + uid),
    read: id => read('persistentCharacters/' + encodeURIComponent(id) + '/state'),
    history: id => read('persistentCharacters/' + encodeURIComponent(id) + '/history')};
}

async function main(args) {
  const command = args.shift();
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    need(['--session', '--code-file', '--patch', '--character', '--write'].includes(key), 'Unknown option');
    if (key === '--write') options.write = true;
    else { need(args[i + 1] && !args[i + 1].startsWith('--'), 'Missing option value'); options[key.slice(2)] = args[++i]; }
  }
  need(['login', 'list', 'show', 'apply'].includes(command), 'Usage: character-patch.cjs login|list|show|apply [--patch file] [--write] [--code-file private-file]');
  // Validate patch shape and file before authenticating.
  const patch = command === 'apply' ? JSON.parse(fs.readFileSync(options.patch, 'utf8')) : null;
  const session = options.session || path.join(os.homedir(), '.config/zargota/operator-session.json');
  const t = await connect({session, codeFile: options['code-file']});
  if (command === 'login') { console.log('Master session paired; following commands reuse it.'); return; }
  if (command === 'apply') {
    const report = await applyPatch(t, patch, {write: !!options.write, backup: data => privateWrite(path.join(path.dirname(session), 'backups', data.input.operationId + '.json'), data)});
    console.log(JSON.stringify({...report, changes: report.changes.map(c => c.field)}, null, 2)); return;
  }
  const sheets = await ownedSheets(t);
  if (command === 'list') console.log(JSON.stringify(sheets.map(s => ({sheetId: s.sheetId, id: s.character.id, campaignKey: s.character.campaignKey, name: s.character.name, revision: s.state.revision})), null, 2));
  else {
    const matches = sheets.filter(s => s.character.campaignKey === options.character || String(s.character.id) === options.character);
    need(matches.length === 1, 'Specify one unique --character ID or campaignKey');
    const s = matches[0];
    console.log(JSON.stringify({sheetId: s.sheetId, revision: s.state.revision, character: s.character}, null, 2));
  }
}
module.exports = {mergePatch, applyPatch, connect};
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
