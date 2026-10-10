'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const injurySource = source.match(/var ZG_INJURY_TABLE=(\[[\s\S]*?\]);\s*function injuryIconMarkup/)[1];
const injuries = vm.runInNewContext(injurySource);
const start = source.indexOf('var MANUAL_CATEGORIES = [');
const end = source.indexOf('//  SHOP PAGE', start);
const host = { innerHTML:'', querySelectorAll(){ return []; } };
const input = { value:'', focus(){} };
const count = {};
const context = {
  window:{ ZARGOTA_INJURY_TABLE:injuries, zgInjuryIconMarkup(i){ return '<img src="'+i.iconPath+'" alt="">'; } },
  document:{ getElementById(id){ return {'manual-page-inner':host, 'manual-search-input':input, 'manual-result-count':count}[id] || null; } },
  manualUiState:{ query:'', category:'all' }, syncManualBridgeUi(){},
  escHTML:String, zgDamageIconMarkup(){ return ''; }
};
vm.runInNewContext(source.slice(start,end), context);
context.renderManualPage();
const html = host.innerHTML;
assert.strictEqual((html.match(/data-manual-tab="rules"/g)||[]).length,17, 'all existing rule sections remain');
assert.strictEqual((html.match(/data-manual-tab="health"/g)||[]).length,2);
assert.strictEqual((html.match(/data-health-key=/g)||[]).length,24, '20 injuries and four sourced ailments');
for (const injury of injuries) {
  assert(html.includes(injury.iconPath));
  assert(html.includes('<p>'+injury.effect+'</p>'));
  assert(html.includes('<p>'+injury.treatment+'</p>'));
}
const death = html.split('data-manual-id="death"')[1].split('data-manual-id=')[0];
assert(!death.includes('data-health-key='), 'injury catalog must not be duplicated under death');
assert(death.includes('zgManualTab(\'health\', \'injuries\')'));
assert(html.includes('до +5'));
assert(!html.includes('расти до +3'));
assert(html.includes('не больше 12 м'));
assert(html.includes('действие передающего'));

function node(attrs, textContent='') {
  return { attrs, textContent, style:{}, hidden:false, open:false,
    classList:{ toggle(){} },
    getAttribute(k){ return this.attrs[k] || null; },
    setAttribute(k,v){ this.attrs[k]=v; },
    hasAttribute(k){ return k in this.attrs; },
    removeAttribute(k){ delete this.attrs[k]; }
  };
}
function section(tab,category,text) {
  const item = node({'data-manual-tab':tab,'data-manual-category':category,'data-manual-open':'0'},text);
  const body=node({}), head=node({});
  item.querySelector = selector => selector === '.manual-section-body' ? body : selector === '.manual-section-head' ? head : null;
  return item;
}
const sections=[section('rules','combat','Атака'),section('rules','equipment','Передача'),section('health','basics','Крысиный Бульк'),section('health','basics','Сломанная рука')];
const cards=[node({},'Крысиный Бульк'),node({},'Сломанная рука')];
cards[1].open=true;
const categories=node({});
host.querySelectorAll=selector => ({'.manual-section':sections,'.manual-health-card':cards,'.manual-category-list':[categories]})[selector] || [];
context.zgManualCategory('combat');
assert.deepStrictEqual(sections.map(s=>s.hidden),[false,true,true,true]);
context.zgManualTab('health');
assert.deepStrictEqual(sections.map(s=>s.hidden),[true,true,false,false], 'rule category must not hide health content');
assert.strictEqual(categories.hidden,true);
assert.strictEqual(count.textContent,'2 / 2');
context.zgManualSearch('бульк');
assert.deepStrictEqual(sections.map(s=>s.hidden),[true,true,false,true]);
assert.strictEqual(cards[0].open,true, 'search reveals the matching collapsed ailment');
assert.strictEqual(cards[1].open,false);
context.zgManualSearchClear();
assert.strictEqual(cards[0].open,false);
assert.strictEqual(cards[1].open,true, 'clearing search restores manually opened details');
context.zgManualTab('rules');
assert.deepStrictEqual(sections.map(s=>s.hidden),[false,true,true,true]);
assert.strictEqual(categories.hidden,false);
console.log('Manual health: section isolation, shared catalog, search disclosure and navigation passed');
