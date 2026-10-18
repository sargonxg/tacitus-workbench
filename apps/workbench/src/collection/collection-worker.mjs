import {validateCollection} from './validate-collection.mjs';
import {validateQuery} from './validate-query.mjs';
let collection=null;
self.onmessage=async event=>{const {id,operation}=event.data;try{
 if(operation==='collection'){
  collection=null;const files=event.data.files,root=files[0]?.webkitRelativePath?.split('/')[0];if(!root)throw Error('Select one complete importer output directory.');
  const entries=files.map(file=>{const parts=file.webkitRelativePath.split('/');if(parts.shift()!==root)throw Error('Choose one directory root.');return {path:parts.join('/'),file};});
  collection=await validateCollection(entries,event.data.expected,(done,total)=>{if(done%16===0||done===total)self.postMessage({id,type:'progress',done,total});});self.postMessage({id,type:'collection',value:collection});
 }else if(operation==='query'){
  if(!collection)throw Error('Verify a collection first.');const file=event.data.file;if(!file||file.size>2097152)throw Error('Choose one query receipt up to 2 MiB.');
  const value=await validateQuery(new Uint8Array(await file.arrayBuffer()),collection);self.postMessage({id,type:'query',value});
 }else throw Error('Unsupported operation');
}catch(error){self.postMessage({id,type:'error',message:String(error?.message??error).slice(0,1000)});}};
