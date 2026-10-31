import assert from 'node:assert/strict';
import { parse } from 'acorn';

function walk(node,visit) {
  if(!node||typeof node!=='object')return;
  if(typeof node.type==='string')visit(node);
  for(const value of Object.values(node)) {
    if(Array.isArray(value))for(const child of value)walk(child,visit);
    else if(value&&typeof value==='object')walk(value,visit);
  }
}
export function assertionCalls(source) {
  const calls=[];
  walk(parse(source,{ecmaVersion:'latest',sourceType:'module'}),node=>{
    if(node.type!=='CallExpression')return;
    const target=node.callee;
    if(target.type==='Identifier'&&target.name==='assert'
      ||target.type==='MemberExpression'&&target.object.type==='Identifier'&&target.object.name==='assert') {
      calls.push(source.slice(node.start,node.end));
    }
  });
  return calls;
}
export function requireOriginalAssertions(original,extended) {
  const expected=assertionCalls(original),actual=assertionCalls(extended);
  const count=list=>list.reduce((map,value)=>map.set(value,(map.get(value)||0)+1),new Map());
  const originalCounts=count(expected),extendedCounts=count(actual);
  for(const [call,total] of originalCounts)assert.ok((extendedCounts.get(call)||0)>=total,'Original assertion missing or changed');
  return {originalAssertions:expected.length,extendedAssertions:actual.length};
}
