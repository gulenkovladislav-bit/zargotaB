'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.doesNotMatch(html, /id="zg-combat-lab-toggle"/, 'GM player control must not require a separate service button');
assert.doesNotMatch(html, /id="zg-combat-lab"/, 'GM player control must not open a blocking laboratory panel');
assert.doesNotMatch(html, /id="zg-gm-player-control"|zg-gm-control-inline/, 'player control must not add duplicate controls above or inside the sheet');
assert.match(html, /id="zg-qa-session-tools"/, 'QA session controls should be available from settings');
assert.match(html, /id="zg-qa-combat-outcome"/, 'QA should allow deterministic miss, hit, and critical paths');
assert.match(html, /id="zg-qa-combat-outcome-toggle"[^>]+aria-pressed="false"/, 'forced hit must be visibly disabled by default');
assert.match(html, /var combatQaOutcome='hit',combatQaOutcomeForced=false/, 'Workshop attacks must use honest random rolls until the GM enables forcing');
assert.match(html, /qaOutcome=combatQaOutcomeForced\?combatQaOutcome:'random'/, 'the local attack resolver must honor the forcing switch');
assert.doesNotMatch(html, /combatQaOutcome='hit';snapshot\.room\.combatEvent=/, 'one QA attack must not silently re-enable forced hits');
assert.match(html, /function combatQaAttackRoll\(mode,forcedOutcome,targetNatural\)/, 'Workshop attacks must use the shared multi-d20 shape');
assert.match(html, /attackRolls:attack\.rolls,attackKeptIndex:attack\.keptIndex/, 'Workshop advantage and disadvantage must publish both d20 values and one kept index');
assert.match(html, /function combatQaBonusRolls\(count,sides,critical\)/, 'Workshop damage must have one reusable independent bonus-dice batch helper');
assert.match(html, /damageRolls:rolled\.rolls\.concat\(bonusRolls\)/, 'Workshop damage must publish every base and bonus die to the batch renderer');
assert.match(html, /function combatAttackRollItems\(event,rolls,outcome\)/, 'combat playback must map a Firebase roll batch without collapsing it');
assert.match(html, /hasKeptIndex\?index===keptIndex/, 'ties between two d20s must keep exactly one indexed die');
assert.match(html, /class="zg-combat-mode-switch" role="radiogroup"/, 'creature roll mode must use a visible three-way switch instead of another spreadsheet-like select');
assert.match(html, /data-mode="advantage"[\s\S]*?data-mode="disadvantage"/, 'the visual switch must expose advantage and disadvantage directly');

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const bodyStart = html.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === '{') depth += 1;
    else if (html[index] === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

function deterministicContext(values) {
  const queue = values.slice();
  const math = Object.create(Math);
  math.random = () => queue.shift() ?? 0.5;
  return { Math:math, Number, Array, result:null };
}

const attackHelper = extractFunction('combatQaAttackRoll');
let helperContext = deterministicContext([0.1, 0.8]);
vm.runInNewContext(`${attackHelper}; result=combatQaAttackRoll('advantage','random',10);`, helperContext);
assert.deepStrictEqual(Array.from(helperContext.result.rolls), [3, 17], 'local advantage must create two independent d20s');
assert.strictEqual(helperContext.result.natural, 17, 'local advantage keeps the higher d20');
assert.strictEqual(helperContext.result.keptIndex, 1, 'local advantage exposes one kept die index');

helperContext = deterministicContext([0.8, 0.1]);
vm.runInNewContext(`${attackHelper}; result=combatQaAttackRoll('disadvantage','random',10);`, helperContext);
assert.deepStrictEqual(Array.from(helperContext.result.rolls), [17, 3], 'local disadvantage must create two independent d20s');
assert.strictEqual(helperContext.result.natural, 3, 'local disadvantage keeps the lower d20');

const bonusHelper = extractFunction('combatQaBonusRolls');
helperContext = deterministicContext([0, 0.2, 0.4]);
vm.runInNewContext(`${bonusHelper}; result=combatQaBonusRolls(3,6,false);`, helperContext);
assert.deepStrictEqual(Array.from(helperContext.result.rolls), [1, 2, 3], 'three approved bonus dice must receive three independent values');
assert.strictEqual(helperContext.result.total, 6, 'bonus damage is the sum of visible dice');

helperContext = deterministicContext([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
vm.runInNewContext(`${bonusHelper}; result=combatQaBonusRolls(3,6,true);`, helperContext);
assert.strictEqual(helperContext.result.rolls.length, 6, 'a critical creates a second visible set of every bonus die');
assert.match(html, /w\.zgQaSessionBuild=function\(\)\{w\.zgSceneBuildQaCombat\(\)/, 'QA arena builder should reuse the established fixture');
assert.match(html, /w\.zgQaSessionStart=function\(\)\{w\.zgQaSessionMode\('combat'\)/, 'QA combat starter should use the explicit workshop mode switch');
assert.match(html, /w\.zgQaSessionFreeRoom=function\(\)/, 'QA needs a Firebase-free transition from combat to free room');
assert.match(html, /snapshot\.room\.combat=\{active:false,phase:'ended'/, 'free-room transition must close the local combat order');
assert.match(html, /if\(combatQaActive\(\)&&w\.zgQaSessionFreeRoom\)/, 'ending a TEST fight must not call the real-room Firebase API');
assert.match(html, /data-qa-session-mode="combat"/, 'settings should expose combat mode');
assert.match(html, /data-qa-session-mode="free"/, 'settings should expose free-room mode');
assert.match(html, /token\.type==='hero';\}\)\.map\(function\(token,index\)\{return copyToken\(Object\.assign\(\{\},token,\{x:25\+\(index\*8\),y:58\+\(index%2\)\*7/, 'QA heroes should start from deterministic staggered test coordinates');
assert.match(html, /w\.zgCombatLabPlayerUid = ''/, 'simulation identity must remain local and must not enter room data');
assert.match(html, /localTestActive&&!incomingTest\)return/, 'real-room reconnect snapshots cannot revoke the offline QA master role');
assert.match(html, /function combatAdvanceLocalQa\(\)/, 'the offline fixture needs a local turn-advance path');
assert.match(html, /w\.ZargotaCombatQa=combatQaApi/, 'one-tab combat should have a local Firebase-free transition adapter');
assert.match(html, /localQa=!!\(w\.zgLocalCombatQaActive[\s\S]*?movementApi=localQa&&w\.ZargotaCombatQa\?w\.ZargotaCombatQa:w\.ZargotaRooms/, 'TEST workshop movement must use the local combat adapter');
assert.match(html, /moveMasterToken:function\(tokenId,targetX,targetY,origin\)\{return combatQaApply/, 'local combat adapter must move the active creature without Firebase');
assert.match(html, /requestMovementAs:function\(uid,targetX,targetY,origin\)\{return combatQaApply/, 'local combat adapter must create a represented-player movement request without Firebase');
assert.match(html, /resolveMovement:function\(uid,accepted\)\{return combatQaApply/, 'local combat adapter must approve or reject that movement request without Firebase');
assert.match(html, /isMaster && movementApi\.requestMovementAs[\s\S]*?movementApi\.requestMovementAs\(actorUid,point\.x,point\.y,origin\)/, 'TEST movement must never fall through to the real Firebase API');
assert.match(html, /useCombatAction:function\(type,participantKey,details\)\{return combatQaApply/, 'local combat adapter must spend direct GM actions without Firebase');
assert.match(html, /var actionApi=combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms/, 'direct action buttons must select the TEST adapter before Firebase');
assert.match(html, /intentApi\.useCombatAction\('short'/, 'direct short-action intent must use the selected local or Firebase adapter');
assert.match(html, /var masterAttackApi=combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms/, 'direct GM attack must use the local adapter in TEST workshop');
assert.match(html, /combatQaActive\(\)&&w\.zgRenderLocalDiceThrow[\s\S]*?'qa-attack-visual-'\+event\.id/, 'TEST creature hit rolls must create one local d20 visual without Firebase');
assert.match(html, /masterPendingAttackRoll=\{id:'gm-attack-drag-'/, 'a direct TEST attack must wait for the GM to drag its hit die');
assert.match(html, /w\.zgCombatMasterAttackRoll=function\(\)[\s\S]*?masterAttackApi\.resolveCombatAttack/, 'the local hit-die release must enter the TEST combat resolver');
assert.match(html, /var masterDamageApi=combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms/, 'direct GM damage roll must stay on the same local adapter');
assert.match(html, /resolveCombatSavingThrow:function\(targetKey,options\)\{return combatQaApply/, 'local QA must resolve saving throws without Firebase');
assert.match(html, /var saveApi=typeof combatQaActive==='function'&&combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms/, 'saving-throw UI must select the TEST adapter before Firebase');
assert.match(html, /gmSetNextDeathCoin:function\(key,coin\)/, 'local QA must support deterministic life/death coin checks');
assert.match(html, /rollDeathSave:function\(key\)/, 'local QA must execute the death-save transition');
assert.match(html, /state:'death-saves',pending:true/, 'local QA death coins must use the production death-save state contract');
assert.match(html, /death\.state=death\.successes>=4\?'stabilized':death\.failures>=4\?'awaiting-gm':'death-saves'/, 'four QA death failures must wait for the GM fate decision');
assert.match(html, /w\.zgVttSetTestRoomSnapshot=function\(snapshot\)/, 'local QA transitions must update the VTT request renderer too');
assert.match(html, /if\(combatAdvanceLocalQa\(\)\)return/, 'local QA must advance before the Firebase route');
assert.match(html, /state=snapshot;if\(w\.zgVttSetTestRoomSnapshot\)w\.zgVttSetTestRoomSnapshot\(snapshot\);if\(w\.zgVttApplyTestSnapshot\)/, 'local turn changes must keep the GM panel and combat renderer on one snapshot');
assert.match(html, /node\.__zgCombatTargetClick=true/, 'target pointerdown should mark the following token click as consumed');
assert.match(html, /if\(node\.__zgCombatTargetClick\)\{node\.__zgCombatTargetClick=false;/, 'target selection must not also open the GM token sheet');
assert.match(html, /function combatLabIsPlayer\(\)/, 'player simulation must be explicit instead of replacing the real session role');
assert.match(html, /w\.zgCombatLabSelect=function\(uid\)/, 'GM must be able to switch between direct and simulated-player control');
assert.match(html, /w\.zgReleasePlayerControl=function\(\)[\s\S]*?zgPossessedPlayerUid=''[\s\S]*?zgCombatLabPlayerUid=''/, 'returning to direct GM control must clear both local identity aliases');
assert.match(html, /function gmControlledPlayerUid\(\)/, 'GM player control follows the current hero without a sheet button');
assert.match(html, /requestAction\([^\n]+combatLabPlayerUid\(\)/, 'simulated attacks must use the normal action request pipeline');
assert.match(html, /intentApi\.requestAction\(text,'combat-intent',combatLabPlayerUid\(\)/, 'simulated short actions must use the local request pipeline');
assert.match(html, /String\(w\.zgCombatLabPlayerUid\|\|w\.zgPossessedPlayerUid\|\|''\)/, 'simulated player drawers must be writable only for the represented hero');
assert.match(html, /abilityApi\.requestAction\('Хочет применить/, 'simulated abilities must use the selected local or Firebase adapter');
assert.match(html, /resolveCombatAbility:function\(uid,targetKeys,overrides\)\{return combatQaApply/, 'local QA must resolve ability damage and healing without Firebase');
assert.match(html, /abilityApi\.resolveCombatAbility\(uid,abilityResolveTargets,abilityResolveDraft\)/, 'GM ability resolution must stay on the selected local or Firebase adapter');
assert.match(html, /prepareApi\.requestAction&&prepareApi\.requestAction\('Хочет подготовить:/, 'simulated prepared actions must use the local request pipeline');
assert.match(html, /requestApprovedAttackRoll\(request\.id,combatLabPlayerUid\(\)\)/, 'hit dice must use the selected GM-controlled player');
assert.match(html, /requestApprovedDamageRoll\(request\.id,combatLabPlayerUid\(\)\)/, 'damage dice must use the selected GM-controlled player');
assert.match(html, /configureCombatIntent:function\(uid,resolution\)\{return combatQaApply/, 'local QA must configure a simulated short-action check without Firebase');
assert.match(html, /rollCombatIntent:function\(requestId,uid\)\{return combatQaApply/, 'local QA must roll a simulated short-action check without Firebase');
assert.match(html, /finishCombatIntent:function\(uid,accepted,notifyPlayer\)\{return combatQaApply/, 'local QA must finish a simulated short-action check and preserve the notification choice without Firebase');
assert.match(html, /var intentApi=typeof combatQaActive==='function'&&combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms;[\s\S]*?intentApi\[rollMethod\]\(request\.id,combatLabPlayerUid\(\)\)/, 'the simulated player check or saving throw must select the local adapter before the network API');
assert.match(html, /function processApprovedAttackRolls\(\)\{[\s\S]*?resolveApi=typeof combatQaActive==='function'&&combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms;[\s\S]*?!resolveApi\)return/, 'automatic hit resolution must remain available when the Firebase API is absent in the workshop');
assert.match(html, /function processApprovedDamageRolls\(\)\{[\s\S]*?resolveApi=typeof combatQaActive==='function'&&combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms;[\s\S]*?!resolveApi\)return/, 'automatic damage resolution must remain available when the Firebase API is absent in the workshop');
assert.match(html, /intentApi\[rollMethod\]\(request\.id,combatLabPlayerUid\(\)\)/, 'short-action checks and saving throws must use the same GM-controlled identity');
assert.match(html, /answerCombatReaction\(request\.id,accepted===true,combatLabPlayerUid\(\)\)/, 'reaction decisions must use the selected GM-controlled player');

['rollCombatIntent','requestApprovedAttackRoll','requestApprovedDamageRoll','answerCombatReaction','acknowledgeCombatReaction'].forEach((name) => {
  assert.match(network, new RegExp(name + ': function \\(requestId[^)]*simulatedPlayerUid'), `${name} must accept an explicit GM simulation identity`);
});
assert.match(network, /session\.role==='master'&&room\.masterUid!==user\.uid/, 'simulation writes must be restricted to the room owner');
assert.doesNotMatch(network, /combatLab|zgCombatLab/, 'the network/data layer must remain unaware of the local UI lab');

console.log('single-client combat lab contracts passed');
