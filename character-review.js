(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaCharacterReview = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var forbidden = ['__proto__', 'prototype', 'constructor'];
  var metadata = ['revision', '_updatedAt', 'updatedAt', 'updatedBy', 'source', 'syncOperationId'];
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function equal(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (v, i) { return equal(v, b[i]); });
    if (object(a) && object(b)) {
      var keys = Object.keys(a), other = Object.keys(b);
      return keys.length === other.length && keys.every(function (k) { return Object.prototype.hasOwnProperty.call(b, k) && equal(a[k], b[k]); });
    }
    return false;
  }
  function key(item) {
    if (!object(item)) return '';
    if (item.itemId != null) return 'item:' + item.itemId;
    if (item.id != null) return 'id:' + item.id;
    return item._syncId ? 'sync:' + item._syncId : '';
  }
  function keyed(list) {
    var seen = new Set();
    return Array.isArray(list) && list.every(function (item) { var id = key(item); if (!id || seen.has(id)) return false; seen.add(id); return true; });
  }
  function prepare(character, newId) {
    var result = clone(character);
    function visit(v) {
      if (Array.isArray(v)) v.forEach(function (item) { if (object(item) && !key(item)) item._syncId = newId(); visit(item); });
      else if (object(v)) Object.keys(v).forEach(function (k) { if (forbidden.indexOf(k) < 0) visit(v[k]); });
    }
    visit(result); return result;
  }
  function snapshot(present, value) { return present ? { exists:true, value:clone(value) } : { exists:false }; }
  function get(document, path) {
    var value = document;
    for (var i = 0; i < path.length; i++) {
      var segment = path[i];
      if (object(segment)) {
        if (!Array.isArray(value)) return snapshot(false);
        var index = value.findIndex(function (v) { return key(v) === segment.item; });
        if (index < 0) return snapshot(false);
        value = value[index];
      } else {
        if (forbidden.indexOf(segment) >= 0 || !object(value) || !Object.prototype.hasOwnProperty.call(value, segment)) return snapshot(false);
        value = value[segment];
      }
    }
    return snapshot(true, value);
  }
  function put(document, path, entry) {
    if (!Array.isArray(path) || !path.length || path.length > 32) throw Error('invalid-path');
    var parent = document;
    path.forEach(function (segment, i) {
      var last = i === path.length - 1;
      if (object(segment)) {
        if (typeof segment.item !== 'string' || !Array.isArray(parent)) throw Error('missing-parent');
        var index = parent.findIndex(function (v) { return key(v) === segment.item; });
        if (last) {
          if (!entry.exists) { if (index >= 0) parent.splice(index, 1); }
          else if (index >= 0) parent[index] = clone(entry.value);
          else parent.push(clone(entry.value));
        } else {
          if (index < 0) throw Error('missing-parent');
          parent = parent[index];
        }
      } else {
        if (typeof segment !== 'string' || forbidden.indexOf(segment) >= 0 || !object(parent)) throw Error('invalid-path');
        if (last) { if (entry.exists) parent[segment] = clone(entry.value); else delete parent[segment]; }
        else {
          if (!Object.prototype.hasOwnProperty.call(parent, segment)) throw Error('missing-parent');
          parent = parent[segment];
        }
      }
    });
  }
  function diff(base, next) {
    var rows = [];
    function walk(a, b, path, aExists, bExists) {
      if (aExists === bExists && equal(a, b)) return;
      if (aExists && bExists && object(a) && object(b)) {
        Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).sort().forEach(function (k) {
          if (forbidden.indexOf(k) >= 0 || (path.length === 0 && metadata.concat(['id','campaignKey']).indexOf(k) >= 0)) return;
          walk(a[k], b[k], path.concat(k), Object.prototype.hasOwnProperty.call(a, k), Object.prototype.hasOwnProperty.call(b, k));
        });
      } else if (aExists && bExists && keyed(a) && keyed(b)) {
        // Compare stable records, never array indexes. Keep the server's order.
        var am = new Map(a.map(function (v) { return [key(v), v]; })), bm = new Map(b.map(function (v) { return [key(v), v]; }));
        Array.from(new Set(Array.from(am.keys()).concat(Array.from(bm.keys())))).forEach(function (k) { walk(am.get(k), bm.get(k), path.concat({item:k}), am.has(k), bm.has(k)); });
      } else rows.push({path:path, before:snapshot(aExists,a), after:snapshot(bExists,b)});
    }
    walk(base || {}, next || {}, [], true, true);
    if (rows.length > 500) throw Error('too-many-changes');
    return rows;
  }
  function analyze(current, changes) {
    if(!Array.isArray(changes)||changes.length>500)throw Error('invalid-changes');
    var paths=[];
    changes.forEach(function(row){
      if(!row||!Array.isArray(row.path)||!row.path.length||row.path.length>32)throw Error('invalid-path');
      if(typeof row.path[0]!=='string'||metadata.concat(['id','campaignKey','_syncId']).indexOf(row.path[0])>=0)throw Error('protected-field');
      row.path.forEach(function(segment){if(typeof segment==='string'){if(forbidden.indexOf(segment)>=0||segment==='_syncId')throw Error('invalid-path');}else if(!object(segment)||typeof segment.item!=='string'||Object.keys(segment).length!==1)throw Error('invalid-path');});
      [row.before,row.after].forEach(function(v){if(!object(v)||typeof v.exists!=='boolean'||(v.exists&&!Object.prototype.hasOwnProperty.call(v,'value')))throw Error('invalid-value');});
      var encoded=row.path.map(function(segment){return JSON.stringify(segment);});
      if(paths.some(function(path){return path.slice(0,Math.min(path.length,encoded.length)).every(function(v,i){return v===encoded[i];});}))throw Error('overlapping-changes');
      paths.push(encoded);
    });
    return changes.map(function (row) {
      var live = get(current, row.path), parent = get(current, row.path.slice(0,-1));
      var status = equal(live, row.after) ? 'applied' : equal(live, row.before) && parent.exists ? 'ready' : 'conflict';
      return {path:clone(row.path), before:clone(row.before), after:clone(row.after), current:live, status:status};
    });
  }
  function apply(current, changes, choices, expected) {
    var rows = analyze(current, changes), result = clone(current), unresolved = [];
    rows.forEach(function (row, i) {
      var choice = choices && choices[i];
      if (choice === 'keep') return;
      // A decision is valid only against the exact field the master reviewed.
      if (expected && !equal(expected[i], row.current)) { unresolved.push(i); return; }
      if (row.status === 'applied') return;
      if (choice !== 'take' && row.status === 'conflict') { unresolved.push(i); return; }
      try { put(result, row.path, row.after); } catch (_) { unresolved.push(i); }
    });
    return unresolved.length ? {ok:false, conflicts:unresolved, rows:rows} : {ok:true, character:result, rows:rows};
  }
  function rebase(base, local, remote) {
    var changes = diff(base,local), rows = analyze(remote,changes), value = clone(remote), nextBase = clone(remote), conflicts = [];
    rows.forEach(function (row,i) {
      if (row.status === 'applied') return;
      try {
        put(value,row.path,row.after);
        if(row.status === 'conflict') { put(nextBase,row.path,row.before); conflicts.push(i); }
      } catch (_) { conflicts.push(i); }
    });
    // A deleted parent cannot be reconstructed safely: retain the complete local draft.
    if (conflicts.some(function(i){return !get(remote,rows[i].path.slice(0,-1)).exists;})) return {base:clone(base),character:clone(local),conflicts:conflicts};
    return {base:nextBase,character:value,conflicts:conflicts};
  }
  return {clone:clone,equal:equal,prepare:prepare,diff:diff,analyze:analyze,apply:apply,rebase:rebase,key:key,get:get};
});
