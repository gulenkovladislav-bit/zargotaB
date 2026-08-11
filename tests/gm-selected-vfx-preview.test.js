'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const triggerStart = html.indexOf('  w.zgGmVisualTrigger=function(type,effect)');
const triggerEnd = html.indexOf('  w.zgGmInterventionAmount=', triggerStart);
const trigger = html.slice(triggerStart, triggerEnd);
const previewStart = trigger.indexOf("if(gmVisualScope==='preview')");
const previewEnd = trigger.indexOf('gmVisualBusy=true', previewStart);
const previewBranch = trigger.slice(previewStart, previewEnd);

assert.ok(triggerStart >= 0 && triggerEnd > triggerStart, 'GM visual trigger remains extractable');
assert.match(html, /var gmVisualScope = 'broadcast'/, 'existing broadcast behavior remains the safe default');
assert.match(html, /Только мне · тест/, 'GM panel exposes an explicit local preview mode');
assert.match(html, /w\.zgGmVisualScope=function\(scope\)/, 'preview scope is controlled independently from intensity');
assert.match(previewBranch, /scope:'local-preview'/, 'local selected-token effects are marked as preview commands');
assert.match(previewBranch, /w\.zgPreviewGmVisualEvent\(localEvent\)/, 'local preview enters the same live renderer');
assert.doesNotMatch(previewBranch, /gmBroadcastVisual|roomSnapshot\.room\.visualEvent|ZargotaRooms/, 'local preview performs no Firebase or room mutation');
assert.match(trigger.slice(previewEnd), /w\.ZargotaRooms&&w\.ZargotaRooms\.gmBroadcastVisual/, 'broadcast mode retains the existing Firebase path');
assert.match(html, /function animateGmVisualEvent\(eventOverride,renderContext\)/, 'live GM renderer accepts an explicit local event and optional preview context');
assert.match(html, /w\.zgPreviewGmVisualEvent=function\(event\)\{return animateGmVisualEvent\(event\);\}/, 'scene controls use a narrow public preview bridge across IIFEs');
assert.match(html, /function sessionCombatMotionMode\(\).*w\.zgCombatMotionState\(\)/, 'session VFX reads motion quality through the public settings bridge');
assert.match(html, /function sessionReducedEffects\(\).*w\.zgReducedEffectsState\(\)/, 'session VFX reads reduced-effects state through the public settings bridge');
const sessionIifeStart = html.indexOf('//   КАРКАС VTT');
const sessionIifeEnd = html.indexOf('})(window);', sessionIifeStart);
const sessionIife = html.slice(sessionIifeStart, sessionIifeEnd);
assert.doesNotMatch(sessionIife, /\bcombatMotionMode\b|\breducedEffects\b/, 'session renderer cannot reach settings variables from another IIFE directly');
assert.match(html, /Локальный эффект · Firebase не изменён/, 'the UI clearly confirms local-only playback');

console.log('GM selected-token VFX preview contract passed');
