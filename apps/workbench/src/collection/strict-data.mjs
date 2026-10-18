// Browser-only local artifact parsing. No network, filesystem paths or code execution.
export const encoder=new TextEncoder();
export const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
export function ensure(ok,message){if(!ok)throw Error(message);}
export function integer(value,low,high,name){ensure(Number.isSafeInteger(value)&&value>=low&&value<=high,`Invalid ${name}`);}
export function field(value,name,max=2000){ensure(typeof value==='string'&&value.trim()&&!value.includes('\0')&&encoder.encode(value).length<=max,`Invalid ${name}`);return value;}
export const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function fields(value,keys,name){ensure(object(value)&&same(Object.keys(value).sort(),[...keys].sort()),`Unsupported ${name} fields`);}
export function same(a,b){return canonical(a)===canonical(b);}
export function safePath(value){field(value,'relative filename',512);const parts=value.split('/');ensure(parts.length<=8&&parts.every(x=>x&&x!=='.'&&x!=='..'&&!/[\\:\0]/.test(x)),'Unsafe selected filename');return value;}
function scalar(value){for(let i=0;i<value.length;i++){const n=value.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const next=value.charCodeAt(++i);ensure(next>=0xdc00&&next<=0xdfff,'Unpaired Unicode surrogate');}else ensure(n<0xdc00||n>0xdfff,'Unpaired Unicode surrogate');}return value;}
/** Duplicate decoded keys, unsafe numeric tokens, nonfinite values and deep/large structures refuse. */
export function strictJSON(bytes){
 const text=typeof bytes==='string'?bytes:decoder.decode(bytes);ensure(encoder.encode(text).length<=2*1024*1024,'JSON exceeds 2 MiB');
 let at=0,nodes=0;const white=()=>{while(/[ \r\n\t]/.test(text[at]||'x'))at++;};
 function string(){const start=at++;let escaped=false;while(at<text.length){const ch=text[at++];if(ch==='"'&&!escaped)return scalar(JSON.parse(text.slice(start,at)));if(ch==='\\'&&!escaped)escaped=true;else escaped=false;}throw Error('Unterminated JSON string');}
 function value(depth){ensure(depth<=32&&++nodes<=200000,'JSON depth/token bound exceeded');white();const ch=text[at];
  if(ch==='"')return string();
  if(ch==='{'){at++;white();const result=Object.create(null),keys=new Set();if(text[at]==='}'){at++;return result;}while(true){white();ensure(text[at]==='"','JSON object key required');const key=string();ensure(!keys.has(key),'Duplicate JSON key');keys.add(key);white();ensure(text[at++]===':','JSON colon required');result[key]=value(depth+1);white();const end=text[at++];if(end==='}')return result;ensure(end===',','JSON comma required');}}
  if(ch==='['){at++;white();const result=[];if(text[at]===']'){at++;return result;}while(true){result.push(value(depth+1));white();const end=text[at++];if(end===']')return result;ensure(end===',','JSON array comma required');}}
  for(const [word,result]of[['true',true],['false',false],['null',null]])if(text.startsWith(word,at)){at+=word.length;return result;}
  const match=/^-?(?:0|[1-9]\d*)/.exec(text.slice(at));ensure(match,'Invalid JSON value');at+=match[0].length;ensure(!/[.eE]/.test(text[at]||''),'Only exact safe integer JSON numbers are supported');const number=Number(match[0]);ensure(Number.isSafeInteger(number),'Unsafe JSON integer');return number;
 }
 const result=value(0);white();ensure(at===text.length,'Trailing JSON content');return result;
}
// All supported numeric fields are safe integers. Unicode codepoint key order matches Python's canonical encoder.
const compare=(a,b)=>{const aa=Array.from(a,x=>x.codePointAt(0)),bb=Array.from(b,x=>x.codePointAt(0));for(let i=0;i<Math.min(aa.length,bb.length);i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return aa.length-bb.length;};
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(object(value))return '{'+Object.keys(value).sort(compare).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';ensure(value===null||typeof value==='string'||typeof value==='boolean'||Number.isSafeInteger(value),'Unsupported canonical value');if(typeof value==='string')scalar(value);return JSON.stringify(value);}
export async function hash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?encoder.encode(bytes):bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
/** Narrow existing importer ZIP profile: contiguous stored entries, no extras/comments/descriptors/ZIP64. */
export function storedZIP(bytes){
 ensure(bytes.length<=1048576&&bytes.length>=22,'Native ZIP exceeds importer bounds');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22;
 const u16=n=>view.getUint16(n,true),u32=n=>view.getUint32(n,true);
 ensure(u32(end)===0x06054b50&&u16(end+4)===0&&u16(end+6)===0&&u16(end+20)===0,'Unsupported ZIP end/disks/comments');
 const count=u16(end+10),centralSize=u32(end+12),centralOffset=u32(end+16);ensure(count===u16(end+8)&&count>0&&count<=64&&centralOffset+centralSize===end,'ZIP central bounds mismatch');
 const result=new Map();let at=centralOffset,localEnd=0,total=0;
 for(let i=0;i<count;i++){
  ensure(at+46<=end&&u32(at)===0x02014b50,'Invalid ZIP central entry');const flags=u16(at+8),method=u16(at+10),crc=u32(at+16),size=u32(at+20),unpacked=u32(at+24),nameLength=u16(at+28),extra=u16(at+30),comment=u16(at+32),disk=u16(at+34),attrs=u32(at+38),offset=u32(at+42);
  ensure((flags===0||flags===2048)&&method===0&&size===unpacked&&size<=2*1024*1024&&nameLength>0&&nameLength<=512&&!extra&&!comment&&!disk&&(attrs>>>16&0xf000)!==0xa000,'Unsupported ZIP compression/flags/attributes');
  ensure(at+46+nameLength<=end&&offset===localEnd&&offset+30<=centralOffset,'ZIP entry overlaps or skips bytes');const name=safePath(decoder.decode(bytes.subarray(at+46,at+46+nameLength)));ensure(!result.has(name),'Duplicate ZIP member');
  ensure(u32(offset)===0x04034b50&&u16(offset+6)===flags&&u16(offset+8)===method&&u32(offset+14)===crc&&u32(offset+18)===size&&u32(offset+22)===size&&u16(offset+26)===nameLength&&u16(offset+28)===0,'ZIP local/central mismatch');
  const start=offset+30+nameLength;ensure(start+size<=centralOffset&&decoder.decode(bytes.subarray(offset+30,start))===name,'ZIP local name/size mismatch');const body=bytes.subarray(start,start+size);ensure(crc32(body)===crc,'ZIP CRC mismatch');
  total+=size;ensure(total<=8*1024*1024,'Expanded ZIP bound exceeded');result.set(name,body);localEnd=start+size;at+=46+nameLength;
 }
 ensure(at===end&&localEnd===centralOffset,'Unconsumed ZIP data');return result;
}
