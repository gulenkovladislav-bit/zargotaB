'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '..', 'story-editor.js'), 'utf8');

assert.match(html, /zgWorkshopModeChoose\('story'\)/, 'Workshop chooser exposes story creation mode');
assert.match(html, /data-qa-session-mode="story"/, 'Workshop settings can switch back to story mode');
assert.match(html, /w\.zgQaSessionStory=function\(\)/, 'story mode has a dedicated local adapter');
assert.match(html, /w\.zgSceneBuildStoryWorkspace=function\(scene\)/, 'story mode has its own empty scene workspace');
assert.match(html, /layers:\[\],tokens:\[\],regions:\[\],fogClouds:\[\]/, 'new story workspaces do not inherit Workshop actors or background');
assert.match(html, /roomSnapshot\.room\.storyMode=true/, 'the local snapshot identifies itself as story authoring rather than a game session');
assert.doesNotMatch(html, /w\.zgQaSessionStory=function\(\)[\s\S]{0,180}zgQaSessionFreeRoom/, 'story mode does not reuse the Workshop free-room fixture');
assert.match(html, /w\.zgGmWorkspaceMode\('edit'\)/, 'story mode enables the existing scene editor');
assert.match(html, /w\.zgStoryEditorOpen\('workshop-story'\)/, 'story mode opens the dialogue map');
assert.match(html, /mode!=='story'&&w\.zgStoryEditorDeactivate/, 'leaving story mode closes its dialogue controls');
assert.match(script, /zargota_story_editor_v1/, 'dialogue projects persist in isolated local storage');
assert.match(script, /ZargotaLib\.list\('story-scene'/, 'story scenes use a library category separate from ordinary game scenes');
assert.match(script, /data-story-scenes/, 'story editor exposes its own scene selector');
assert.match(script, /data-story-clock/, 'story editor exposes a separate date visibility control');
assert.match(script, /story-clock-visible/, 'date visibility is applied only to story mode');
assert.match(script, /delayMs/, 'dialogue links store an editable delay');
assert.match(script, /data-story-link/, 'dialogue connections are directly selectable');
assert.match(script, /data-story-field="link-to"/, 'a connection target can be changed in the inspector');
assert.match(script, /w\.zgStoryEditorDeactivate=function/, 'dialogue controls can be fully deactivated on mode switch');
assert.match(script, /Затримка, мс/, 'new story UI includes its Ukrainian copy');

const css = fs.readFileSync(path.join(__dirname, '..', 'story-editor.css'), 'utf8');
assert.match(css, /story-mode \.zg-gm-actions/, 'story mode hides the online GM control strip');
assert.match(css, /story-mode \.zg-vtt-journal/, 'story mode hides the online chronicle and chat');
assert.match(css, /story-mode \[id\^="zg-combat-"\]/, 'story mode hides combat controls and participant prompts');
assert.match(css, /story-mode #zg-scene-settings \.zg-scene-library-section/, 'ordinary game scenes stay outside story authoring');
assert.match(css, /story-clock-visible #zg-world-clock/, 'the date can be explicitly enabled in story mode');

console.log('story editor contract passed');
