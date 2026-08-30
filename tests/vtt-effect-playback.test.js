const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(__dirname, '..', 'zargota-network.js'), 'utf8');

const movementStart = html.indexOf('  function animateLastMovement(movementOverride)');
const movementEnd = html.indexOf('  function applyCamera()', movementStart);
const movement = html.slice(movementStart, movementEnd);
const movementCancelStart = html.indexOf('  function cancelActiveMovementPlayback(');
const movementCancelEnd = html.indexOf('  function animateLastMovement(', movementCancelStart);
const movementCancel = html.slice(movementCancelStart, movementCancelEnd);
assert.ok(movementStart >= 0 && movementEnd > movementStart, 'movement playback must remain extractable');
const movementCanvasStart = html.indexOf('  function playLiveMovementCanvas(movement,duration)');
const movementCanvasEnd = html.indexOf('  function coalescedMovementStart(', movementCanvasStart);
const movementCanvas = html.slice(movementCanvasStart, movementCanvasEnd);
assert.ok(movementCanvasStart >= 0 && movementCanvasStart < movementStart, 'movement Canvas helper remains extractable');
assert.ok(movementCanvasEnd > movementCanvasStart, 'movement Canvas helper has a stable end boundary');
assert.match(movementCanvas, /channel:'live-movement',durationMs:duration/, 'movement trail shares an exactly-once runtime command and event duration');
assert.match(movementCanvas, /scope:'public'/, 'GM and player derive the movement trail from the same public event');
assert.match(movementCanvas, /zgSchedulePlaybackCleanup\(event,'live-canvas-movement'/, 'movement Canvas cleanup uses the shared scheduler');
assert.doesNotMatch(movementCanvas, /setTimeout\(|setInterval\(|requestAnimationFrame\(/, 'movement Canvas creates no private scheduler');
assert.match(html, /var activeMovementFrame = 0;/, 'movement owns one tracked RAF');
assert.match(movementCancel, /if\(activeMovementFrame\)\{cancelAnimationFrame\(activeMovementFrame\);activeMovementFrame=0;/, 'a new movement cancels the previous RAF');
assert.match(movement, /cancelActiveMovementPlayback\(continued\?'coalesced':'replaced',!continued\)/, 'a replacement snapshot uses the shared movement cancellation path');
assert.match(movement, /activeMovementFrame=requestAnimationFrame\(frame\)/, 'every movement frame is tracked');
assert.doesNotMatch(movement, /(?<!activeMovementFrame=)requestAnimationFrame\(frame\)/, 'movement cannot start an untracked parallel RAF');
assert.match(movement, /if \(trailLayer&&!reducedEffects&&combatMotionMode!=='minimal'\)/, 'the original boot-print trail remains the primary movement visual');
assert.doesNotMatch(movement, /playLiveMovementCanvas\(/, 'Canvas route cannot replace the established boot-print trail');
assert.match(movement, /if\(reducedEffects\)duration=Math\.min\(duration,260\)/, 'reduced motion shortens positional travel');
assert.match(movement, /movePxX=\(toX-fromX\)\/100\*/, 'movement converts the scene delta to client-local pixels once');
assert.match(movement, /node\.style\.transform='translate\(-50%,-50%\) translate3d\(.*rotate\('\+walkAngle\+'deg\) translateY\('\+walkLift\+'px\)'/, 'movement keeps compositor translation together with the established walking sway');
assert.doesNotMatch(movement, /node\.style\.left=\(fromX\+\(toX-fromX\)\*progress\)/, 'movement frames do not trigger layout through left');
assert.doesNotMatch(movement, /node\.style\.top=\(fromY\+\(toY-fromY\)\*progress\)/, 'movement frames do not trigger layout through top');
assert.match(movement, /setRafActive\(true,'token-movement'\)/, 'movement RAF is visible in shared diagnostics');
assert.match(movement, /setRafActive\(false,'token-movement'\)/, 'movement RAF diagnostics close on completion and replacement');
assert.match(movement, /zgSchedulePlaybackCleanup\)w\.zgSchedulePlaybackCleanup\(movement,'movement-footprints'/, 'footprint cleanup uses the shared scheduler');

const adjustmentStart = html.indexOf('  function animateGmAdjustmentVisual()');
const adjustmentEnd = html.indexOf('  function gmVisualTarget(', adjustmentStart);
const adjustment = html.slice(adjustmentStart, adjustmentEnd);
assert.match(adjustment, /claimCombatPlaybackEvent\(event,'gm-adjustment'\)/, 'GM panel effects use the shared exactly-once registry');
['label','hitFx','particles','sound'].forEach(channel => assert.match(adjustment, new RegExp("claimCombatPlaybackEvent\\(event,'"+channel+"'\\)"), 'GM adjustment owns '+channel+' channel'));
assert.match(adjustment, /sessionCombatMotionMode\(\)!=='minimal'/, 'minimal mode skips GM adjustment particles through the shared settings bridge');
assert.match(adjustment, /canvasPlayed=playParticles&&playLiveGmAdjustmentCanvas\(event,target\)/, 'GM adjustment particles prefer the shared Canvas runtime');
assert.match(adjustment, /!canvasPlayed&&sessionCombatMotionMode\(\)!=='minimal'/, 'legacy DOM particles remain an explicit fallback');
assert.match(adjustment, /schedulePlaybackCleanup\(event,'gm-adjustment'/, 'GM adjustment cleanup uses the shared timer queue');
assert.doesNotMatch(adjustment, /setTimeout\(/, 'GM adjustment does not create a private cleanup timer');

const visualStart = html.indexOf('  function animateGmVisualEvent(eventOverride,renderContext)');
const visualEnd = html.indexOf('  function combatStatusSummary(', visualStart);
const visual = html.slice(visualStart, visualEnd);
assert.match(visual, /claimCombatPlaybackEvent\(event,'gm-vfx'\)/, 'broadcast VFX are exactly-once');
assert.match(visual, /sessionCombatBudget\(intensity==='strong'\?'high':intensity==='soft'\?'low':'balanced',34,24,8\)/, 'heavy token VFX use the shared per-client quality budget');
assert.match(visual, /sparkCount=sessionCombatBudget\(intensity==='strong'\?'high':intensity==='soft'\?'low':'balanced',30,18,6\)/, 'heavy scene VFX use the shared per-client quality budget');
assert.match(visual, /claimCombatPlaybackEvent\(event,'sound'\)/, 'broadcast VFX sound is exactly-once');
assert.doesNotMatch(visual, /setTimeout\(/, 'broadcast VFX cleanup uses the shared timer queue');
assert.match(html, /html\.zg-combat-motion-anchored \.zg-vtt-token\.zg-gm-vfx-shake/, 'anchored mode replaces token displacement with a stationary reaction');

assert.match(network, /gmAdjustEventSequence=\(gmAdjustEventSequence\+1\)%1679616/, 'GM adjustment IDs own a monotonic same-client sequence');
assert.match(network, /eventId='gm-adjust-'\+stamp\+'-'\+gmAdjustEventSequence\.toString\(36\)\+'-'\+Math\.random\(\)\.toString\(36\)\.slice\(2,7\)/, 'GM adjustment IDs survive same-millisecond and deterministic-random operations');

const rollQueueStart = html.indexOf('  function queueRollAnimations()');
const rollQueueEnd = html.indexOf('  function render(snapshot)', rollQueueStart);
const rollQueue = html.slice(rollQueueStart, rollQueueEnd);
assert.match(html, /var rollAnimationsFrame = 0;/, 'dice rendering owns one pending RAF');
assert.match(rollQueue, /if\(rollAnimationsFrame\)return false;/, 'Firebase snapshots coalesce dice rendering');
assert.match(rollQueue, /rollAnimationsFrame=requestAnimationFrame\(function\(\)\{rollAnimationsFrame=0;renderRollAnimations\(\);\}\)/);
assert.doesNotMatch(html.slice(rollQueueEnd, html.indexOf('  w.zgVttApplyTestSnapshot', rollQueueEnd)), /requestAnimationFrame\(renderRollAnimations\)/, 'snapshot render cannot enqueue parallel dice RAF callbacks');

console.log('VTT effect playback contract passed');
