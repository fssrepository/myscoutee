import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// Follow the current watch output only. Old hashed chunks can occupy many GB.
export function compiledDevModules(directory) {
 const dir=resolve(directory),files=readdirSync(dir),exports=new Map(),seen=new Set();
 const latest=prefix=>files.filter(f=>f.startsWith(prefix)&&f.endsWith('.js')).sort((a,b)=>statSync(resolve(dir,b)).mtimeMs-statSync(resolve(dir,a)).mtimeMs)[0];
 const load=file=>import(pathToFileURL(resolve(dir,file)).href);
 const queue=['main.js'];
 while(queue.length){
  const file=queue.pop();if(seen.has(file))continue;seen.add(file);
  const source=readFileSync(resolve(dir,file),'utf8');
  for(const m of source.matchAll(/(?:from\s+|import\()"\.\/([^"?]+\.js)"/g))queue.push(m[1]);
  const block=source.slice(source.lastIndexOf('export {'));
  for(const m of block.matchAll(/^\s+(\w+)(?: as (\w+))?,?$/gm))exports.set(m[2]??m[1],file);
 }
 return {latest,load,symbol:async name=>{const file=exports.get(name);assert.ok(file,`Current compiled export: ${name}`);return (await load(file))[name];}};
}
