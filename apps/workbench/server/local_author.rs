// Workbench adapter using the unchanged pinned native Capture/pack contracts.
use serde::Deserialize;
use std::{fs,io::{Read,Write}};
use tacitus_analysis::knowledge_capture::{self as k,Capture};
use tacitus_capsules::strict_json;
use tacitus_core::digest;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input { capture: Capture, quotes: [String;2] }
fn run()->Result<(),String>{
 let args:Vec<_>=std::env::args().collect();if args.len()!=3{return Err("fixed input and new output required".into());}
 let mut bytes=Vec::new();fs::File::open(&args[1]).map_err(|e|e.to_string())?.take(262145).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
 if bytes.len()>262144{return Err("author input limit".into());}
 let mut input:Input=strict_json::from_slice(&bytes)?;
 if input.capture.documents.len()!=1||input.capture.assertions.len()!=2{return Err("one source and two annotations required".into());}
 let doc=&input.capture.documents[0];doc.validate()?;
 if doc.original_hash.as_deref()!=Some(digest(doc.text.as_bytes()).as_str()){return Err("original bytes mismatch".into());}
 for (a,quote) in input.capture.assertions.iter().zip(&input.quotes){
  if a.evidence.len()!=1||quote.is_empty()||doc.text.char_indices().filter(|(i,_)|doc.text[*i..].starts_with(quote)).count()!=1||doc.passage(&a.evidence[0])?!=quote{return Err("exact unique UTF-8 quote required".into());}
 }
 input.capture.graph.claim_fingerprints=input.capture.assertions.iter().map(|a|(a.id.clone(),a.fingerprint())).collect();
 let archive=k::pack(&serde_json::to_vec(&input.capture).map_err(|e|e.to_string())?)?;
 if archive.len()>1048576{return Err("author archive limit".into());}
 let inspection=k::inspect(&archive)?;
 let mut options=fs::OpenOptions::new();options.write(true).create_new(true);
 #[cfg(unix)] {use std::os::unix::fs::OpenOptionsExt;options.mode(0o600);}
 options.open(&args[2]).map_err(|e|e.to_string())?.write_all(&archive).map_err(|e|e.to_string())?;
 let out=serde_json::to_vec(&inspection).map_err(|e|e.to_string())?;std::io::stdout().write_all(&out).map_err(|e|e.to_string())?;Ok(())
}
fn main(){if run().is_err(){eprintln!("local authoring validation failed");std::process::exit(1)}}
