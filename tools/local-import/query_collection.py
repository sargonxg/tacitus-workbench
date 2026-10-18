#!/usr/bin/env python3
"""Bounded native collection query; exact child packets remain separate evidence."""
import argparse, base64, copy, hashlib, io, json, os, pathlib, re, signal, sys, tempfile, time, zipfile
import import_collection as imp

FORMAT='tacitus-native-collection-context/1'
REQUEST='tacitus-native-collection-query/1'
ERROR='tacitus-native-collection-error/1'
MAX_GLOBAL=2*1024*1024
MIN_CHILD=2048
MAX_CHILD=250000
HEX=re.compile('[a-f0-9]{64}')
SOURCE=re.compile('s-[a-f0-9]{64}')
WARNING=[
 'Separate immutable native responses; no merged Context, cross-capsule inference, conflict resolution or generated answer.',
 'All native capsules executed does not mean all evidence retained. Decode each response for exact per-claim omissions and qualifications.',
 'Source-only documents are excluded from native queries; use the collection lexical query command to search those full sources.',
 'Unreviewed user-authored proposals. Authorship, rights and truth are unverified. Modern checkpoints do not reconstruct historical knowledge.',
 'Duplicate content/provenance identities are not independent corroboration. Equal per-capsule limits are a resource policy, not relevance ranking.'
]


class Refusal(ValueError):
 def __init__(self,code,capsule=None):
  self.code=code;self.capsule=capsule
  super().__init__(code)


def require(value,code):
 if not value:raise Refusal(code)


def digest(value):return isinstance(value,str) and HEX.fullmatch(value) is not None


def request(raw):
 require(len(raw)<=65536,'request_too_large')
 q=imp.parse(raw)
 keys={'format','manifest_sha256','snapshot_sha256','question','known_as_of','valid_at','time_mode','max_bytes','revoked_sources','revoked_capsules'}
 require(isinstance(q,dict) and set(q)==keys and q['format']==REQUEST,'invalid_request_fields')
 require(digest(q['manifest_sha256']) and digest(q['snapshot_sha256']),'expected_manifest_and_snapshot_hash_required')
 require(isinstance(q['question'],str) and q['question'].strip() and '\0' not in q['question'] and len(q['question'].encode())<=2000,'invalid_question')
 require(all(type(q[k]) is int and -(2**63)<=q[k]<2**63 for k in ('known_as_of','valid_at')),'invalid_checkpoints')
 require(type(q['max_bytes'])is int and 4096<=q['max_bytes']<=MAX_GLOBAL,'invalid_global_budget')
 require(q['time_mode']in ('disclose_unknown','require_declared_interval'),'invalid_validity_policy')
 for name in ('revoked_sources','revoked_capsules'):
  values=q[name]
  require(isinstance(values,list) and len(values)<=256 and all(isinstance(v,str) and len(v)<=256 for v in values),'invalid_revocations')
  require(len(set(values))==len(values),'duplicate_revocations')
 return q


def validate_manifest(m,q):
 require(isinstance(m,dict) and m.get('format')==imp.OUTPUT and m.get('complete')is True,'incomplete_or_unsupported_collection')
 imp.field(m.get('collection'),'collection',200);imp.field(m.get('author'),'author',200)
 require(m.get('core_pin')==imp.PIN and digest(m.get('producer_sha256')),'unsupported_producer_or_core_pin')
 sources=m.get('sources');require(isinstance(sources,list) and 1<=len(sources)<=256,'invalid_source_count')
 require(imp.sha(imp.enc(sources))==m.get('snapshot_sha256')==q['snapshot_sha256'],'snapshot_mismatch')
 ids=[];source_only=[];authored=[];mapping={}
 for s in sources:
  require(isinstance(s,dict) and SOURCE.fullmatch(s.get('id',''))is not None,'invalid_source_id')
  imp.field(s.get('key'),'source_key',200)
  require(s['id']=='s-'+imp.sha(imp.enc([m['collection'],s['key']])),'source_identity_mismatch')
  require(digest(s.get('revision')) and digest(s.get('text_sha256')),'invalid_source_revision')
  require(type(s.get('version'))is int and 1<=s['version']<=2147483647 and type(s.get('checkpoint'))is int and 0<=s['checkpoint']<2**63,'invalid_source_version_or_checkpoint')
  require(s.get('semantic_status')in ('no semantic assertions authored','unreviewed explicitly authored proposals'),'unsupported_semantic_status')
  if s['semantic_status']=='no semantic assertions authored':
   require(s.get('annotation_author')is None,'source_only_authorship_mismatch');source_only.append(s['id'])
  else:
   imp.field(s.get('annotation_author'),'annotation_author',200);authored.append(s['id'])
  ids.append(s['id']);mapping[s['id']]=s
 require(len(set(ids))==len(ids) and ids==sorted(ids),'duplicate_or_unordered_source_ids')
 require(m.get('source_only_ids')==source_only,'source_only_coverage_mismatch')
 groups={}
 for sid,s in mapping.items():groups.setdefault(s['text_sha256'],[]).append(sid)
 require(m.get('duplicate_content_groups')==[v for _,v in sorted(groups.items())if len(v)>1],'duplicate_content_lineage_mismatch')
 files=m.get('files');require(isinstance(files,dict) and 1<=len(files)<=2048,'invalid_file_inventory')
 for name,h in files.items():
  imp.relative(name);require(name!='manifest.json' and digest(h),'invalid_file_inventory_entry')
 caps=m.get('native_capsules');require(isinstance(caps,list) and len(caps)<=256,'invalid_native_capsule_count')
 members=[];seen_archives=set();seen_paths=set()
 for cap in caps:
  require(isinstance(cap,dict) and set(cap)=={'path','input_sha256','archive_sha256','source_ids','sources','assertions','checkpoint'},'invalid_native_descriptor')
  require(digest(cap['input_sha256']) and digest(cap['archive_sha256']),'invalid_capsule_identity')
  require(cap['path']=='native/'+cap['input_sha256']+'.zip' and files.get(cap['path'])==cap['archive_sha256'],'capsule_path_or_digest_mismatch')
  require(cap['path']not in seen_paths and cap['archive_sha256']not in seen_archives,'duplicate_capsule')
  seen_paths.add(cap['path']);seen_archives.add(cap['archive_sha256'])
  group=cap['source_ids'];require(isinstance(group,list) and 1<=len(group)<=25 and all(isinstance(x,str) and x in authored for x in group),'unknown_or_source_only_native_member')
  require(group==sorted(group) and len(set(group))==len(group),'duplicate_or_unordered_capsule_members')
  require(type(cap['sources'])is int and type(cap['assertions'])is int and cap['sources']==len(group) and cap['assertions']==2*len(group),'capsule_count_mismatch')
  require(type(cap['checkpoint'])is int and cap['checkpoint']==max(mapping[x]['checkpoint']for x in group),'capsule_checkpoint_mismatch')
  members+=group
 require(len(members)==len(set(members)) and set(members)==set(authored),'incomplete_or_duplicate_native_coverage')
 require({name for name in files if name.startswith('native/')}==seen_paths,'extra_or_missing_native_files')
 known={sid+'@'+str(s['version']) for sid,s in mapping.items()}
 require(set(q['revoked_sources'])<=known,'unknown_source_revocation_reference')
 require(set(q['revoked_capsules'])<=seen_archives,'unknown_capsule_revocation_reference')
 require(not q['revoked_sources'] and not q['revoked_capsules'],'revoked_collection_artifact')
 if not caps:raise Refusal('source_only_collection_use_lexical_query')
 require(digest(m.get('core_sha256')),'missing_collection_core_identity')
 return mapping,sorted(caps,key=lambda c:tuple(c['source_ids']))


def capsule_data(path,cap,m,mapping):
 raw=path.read_bytes();require(len(raw)<=1024*1024 and imp.sha(raw)==cap['archive_sha256'],'capsule_archive_mismatch')
 with zipfile.ZipFile(io.BytesIO(raw))as z:
  items=z.infolist()
  require(len(items)<=64 and len({v.filename for v in items})==len(items) and sum(v.file_size for v in items)<=8*1024*1024 and all(v.file_size<=2*1024*1024 for v in items),'capsule_archive_resource_limit')
  manifest=imp.parse(z.read('manifest.json'));data=imp.parse(z.read('capsule.json'))
  require(manifest.get('schema_version')==2 and manifest.get('package_version')==1 and manifest.get('scope')=='local-authoring' and manifest.get('profile')=='context' and manifest.get('evidence_mode')=='evidence_included' and manifest.get('confidentiality')=='private' and manifest.get('dependencies')==[],'unsupported_capsule_profile')
  require(manifest.get('id')=='batch-'+imp.sha(imp.enc(cap['source_ids'])) and manifest.get('created_at')==cap['checkpoint'] and manifest.get('author')==m['author'] and manifest.get('title')==m['collection'],'capsule_manifest_lineage_mismatch')
  require(len(data.get('sources',[]))==cap['sources'] and len(data.get('assertions',[]))==cap['assertions'] and data.get('methods')==[] and data.get('reviews')==[],'native_data_count_mismatch')
  source_data={};full={}
  for s in data['sources']:
   require(s.get('id')in cap['source_ids'] and s['id']not in source_data,'unknown_or_duplicate_native_source')
   require(s.get('workspace')=='local-authoring' and s.get('published_at')is None and s.get('valid_from')is None and s.get('valid_until')is None and s.get('withdrawn')is False and s.get('restricted')is False and s.get('redistributable')is True,'unsupported_imported_source_policy')
   expected=mapping[s['id']];key=s['id']+'@'+str(s.get('version'))
   require(s.get('version')==expected['version'] and s.get('text_hash')==s.get('original_hash')==expected['text_sha256'] and s.get('available_at')==s.get('retrieved_at')==expected['checkpoint'],'native_source_lineage_mismatch')
   declaration='Unverified annotation authorship declaration: '+imp.enc({'source':key,'annotation_author':expected['annotation_author']}).decode()
   require(declaration in manifest.get('limitations',[]),'annotation_author_lineage_mismatch')
   body=z.read('evidence/'+imp.sha(key.encode())+'.txt')
   require(len(body)<=32768 and imp.sha(body)==expected['text_sha256'] and body.decode().encode()==body,'source_bytes_mismatch')
   source_data[s['id']]=s;full[key]=body
  require(set(source_data)==set(cap['source_ids']),'missing_native_source')
  assertions={}
  for a in data['assertions']:
   require(isinstance(a.get('id'),str) and a['id']not in assertions,'duplicate_native_assertion')
   require(a.get('epistemic_type')=='reported_statement' and imp.UNREVIEWED in a.get('conditions',[]),'unsupported_or_unmarked_assertion')
   require(len(a.get('evidence',[]))==1,'invalid_native_evidence')
   span=a['evidence'][0];key=span.get('source');require(key in full,'unknown_native_source_reference')
   source=mapping[key.rsplit('@',1)[0]]
   require(span.get('text_hash')==source['text_sha256'] and type(span.get('start'))is int and type(span.get('end'))is int and 0<=span['start']<span['end']<=len(full[key]),'invalid_native_quote_binding')
   full[key][span['start']:span['end']].decode('utf-8')
   assertions[a['id']]=a
  sidecar=imp.parse(data['artifacts']['tacitus.uploaded-knowledge/1'])
  require(sidecar.get('observed_at')=={cid:None for cid in assertions} and sidecar.get('graph',{}).get('knowledge')=={},'unsupported_imported_observation_or_knowledge')
  # Reconstruct the exact canonical pre-pack input, including quote strings.
  # Native serialization fills fingerprints/files and clears source text only.
  original_manifest=copy.deepcopy(manifest);original_manifest['files']={}
  graph=copy.deepcopy(sidecar['graph']);graph['claim_fingerprints']={}
  documents=[{**s,'text':full[s['id']+'@'+str(s['version'])].decode()}for s in data['sources']]
  quotes=[]
  for a in data['assertions']:
   span=a['evidence'][0];text=full[span['source']].decode();quote=full[span['source']][span['start']:span['end']].decode();at=text.find(quote)
   require(quote and '\r'not in quote and '\n'not in quote and at>=0 and text.find(quote,at+1)<0,'invalid_or_ambiguous_native_quote')
   quotes.append(quote)
  reconstructed=dict(capture=dict(manifest=original_manifest,documents=documents,assertions=data['assertions'],graph=graph,observed_at=sidecar['observed_at'],extractor=sidecar['extractor'],confirms_rights=True),quotes=quotes)
  require(imp.sha(imp.enc(reconstructed))==cap['input_sha256'],'capture_input_digest_mismatch')
  require(set(assertions)=={sid+suffix for sid in cap['source_ids']for suffix in('-a','-b')},'unexpected_native_assertion_identity')
  return dict(manifest=manifest,sources={s['id']+'@'+str(s['version']):s for s in source_data.values()},full=full,assertions=assertions,graph=sidecar['graph'],observed_at=sidecar['observed_at'])


def frame(m,q,caps,mapping):
 records=[]
 for cap in caps:
  lineage=[dict(source=sid+'@'+str(mapping[sid]['version']),text_sha256=mapping[sid]['text_sha256'],revision=mapping[sid]['revision'],annotation_author=mapping[sid]['annotation_author'])for sid in cap['source_ids']]
  records.append(dict(capsule_archive_sha256=cap['archive_sha256'],capture_input_sha256=cap['input_sha256'],checkpoint=cap['checkpoint'],member_sources=lineage,native_max_bytes=MAX_CHILD,native_bytes=MAX_CHILD,context_sha256='0'*64,native_outcome='omission_only',selected_claims=cap['assertions'],selected_sources=cap['sources'],native_omission_entries=1024,native_omissions_sha256='0'*64,context_encoding='base64; exact UTF-8 native JSON bytes',context_base64=''))
 return dict(format=FORMAT,execution_complete=True,collection=m['collection'],manifest_sha256=q['manifest_sha256'],snapshot_sha256=m['snapshot_sha256'],producer_sha256=m['producer_sha256'],core_pin=imp.PIN,core_sha256=m['core_sha256'],query=q,allocation='Equal deterministic per-capsule native limits; remainder follows stable source-ID order; unused allowance is not redistributed.',warnings=WARNING,coverage=dict(declared_sources=len(mapping),authored_sources=sum(c['sources']for c in caps),source_only_sources=len(m['source_only_ids']),source_only_ids=[sid+'@'+str(mapping[sid]['version']) for sid in m['source_only_ids']],native_capsules=len(caps),executed_capsules=len(caps),selected_claims=sum(c['assertions']for c in caps),selected_sources=sum(c['sources']for c in caps)),duplicate_content_groups=m.get('duplicate_content_groups',[]),records=records)


def allocate(envelope,global_budget):
 # Empty payload records reserve all metadata at maximum count/number widths.
 overhead=len(imp.enc(envelope))+1
 count=len(envelope['records']);groups=(global_budget-overhead)//4
 minimum=(MIN_CHILD+2)//3
 require(groups>=count*minimum,'global_budget_cannot_hold_all_child_minimums_and_receipt')
 each,extra=divmod(groups,count)
 limits=[min(MAX_CHILD,3*(each+(1 if i<extra else 0)))for i in range(count)]
 require(all(MIN_CHILD<=n<=MAX_CHILD for n in limits),'invalid_child_allocation')
 require(overhead+sum(4*((n+2)//3)for n in limits)<=global_budget,'global_allocation_overflow')
 return limits


def validate_context(raw,cap,expected,q,limit):
 require(len(raw)<=limit,'native_response_budget_exceeded')
 out=imp.parse(raw);packet=out.get('context',{})
 require(out.get('format')=='tacitus-uploaded-knowledge-context/1' and out.get('archive_digest')==cap['archive_sha256'] and out.get('manifest')==expected['manifest'],'native_response_identity_mismatch')
 require(packet.get('question')==q['question'] and packet.get('known_as_of')==q['known_as_of'] and packet.get('valid_at')==q['valid_at'] and packet.get('workspace')=='local-authoring','native_response_request_mismatch')
 claims=packet.get('claims');metadata=out.get('source_metadata');omissions=packet.get('omissions')
 require(isinstance(claims,dict) and isinstance(metadata,dict) and isinstance(omissions,dict) and len(omissions)<=1024,'invalid_native_packet')
 require(set(omissions)<=set(expected['assertions']) and not set(omissions)&set(claims) and set(omissions)|set(claims)==set(expected['assertions']) and all(isinstance(v,str)and v and len(v.encode())<=2000 for v in omissions.values()),'unknown_or_incomplete_native_omission_reference')
 require(set(out.get('observed_at',{}))==set(claims) and set(out.get('temporal_status',{}))==set(claims),'native_temporal_membership_mismatch')
 cited=set()
 for cid,v in claims.items():
  require(cid in expected['assertions'] and v.get('assertion')==expected['assertions'][cid],'unknown_or_changed_native_assertion')
  require(out['observed_at'][cid]==expected['observed_at'][cid] and out['temporal_status'][cid]=='UNKNOWN world validity; requested date applicability unverified','native_temporal_value_mismatch')
  require(v.get('knowledge')=='unknown','native_knowledge_value_mismatch')
  a=v['assertion'];require(isinstance(v.get('citations'),list) and len(v['citations'])==len(a['evidence']),'native_citation_count_mismatch')
  for citation in v['citations']:
   span=citation.get('span');require(span in a['evidence'],'unknown_native_citation')
   key=span['source'];require(key in expected['full'] and key in metadata,'unknown_response_source_reference')
   require(citation.get('text')==expected['full'][key][span['start']:span['end']].decode(),'native_quote_text_mismatch')
   require(metadata[key]==expected['sources'][key],'native_source_metadata_mismatch')
   source=expected['sources'][key]
   require(citation.get('title')==source['title'] and citation.get('family')==source['source_family'] and citation.get('license')==source['license'],'native_citation_provenance_mismatch')
   cited.add(key)
 require(set(metadata)==cited,'unknown_or_unused_native_source_metadata')
 for key,node in packet.get('entities',{}).items():require(key in expected['graph']['nodes'] and node==expected['graph']['nodes'][key],'unknown_or_changed_native_entity')
 for link in packet.get('relationships',[]):require(link in expected['graph']['links'] and link['from']in claims and link['to']in claims,'unknown_or_changed_native_relationship')
 require(out.get('status')==('unreviewed_evidence_context' if claims else 'omission_only; no answer or evidence retained'),'native_status_mismatch')
 return dict(native_bytes=len(raw),context_sha256=imp.sha(raw),native_outcome='selected' if claims else 'omission_only',selected_claims=len(claims),selected_sources=len(metadata),native_omission_entries=len(omissions),native_omissions_sha256=imp.sha(imp.enc(omissions)),context_base64=base64.b64encode(raw).decode('ascii'))


def query_collection(root,q,core_path,core_sha256,temp_root=None):
 end=time.monotonic()+60
 def remaining():
  value=end-time.monotonic();require(value>0,'collection_query_deadline');return min(value,10)
 root_fd=imp.directory(root)
 try:
  raw=imp.read_under(root_fd,'manifest.json',1024*1024)
  require(imp.sha(raw)==q['manifest_sha256'],'collection_manifest_mismatch')
  m=imp.parse(raw);mapping,caps=validate_manifest(m,q)
  require(core_sha256==m['core_sha256'],'collection_core_digest_mismatch')
  imp.executable(core_path,core_sha256)
  envelope=frame(m,q,caps,mapping);limits=allocate(envelope,q['max_bytes'])
  with tempfile.TemporaryDirectory(prefix='tacitus-collection-query-',dir=temp_root)as directory:
   stage=pathlib.Path(directory);verified={};total=0
   # Every inventory entry is verified before any core query; execute no collection code.
   for name,h in sorted(m['files'].items()):
    remaining();body=imp.read_under(root_fd,name,2*1024*1024);total+=len(body)
    require(total<=64*1024*1024 and imp.sha(body)==h,'collection_file_hash_or_size_mismatch')
    if name.startswith('native/'):
     target=stage/pathlib.PurePosixPath(name).name;target.write_bytes(body);verified[name]=target
   # Execute a verified private copy, eliminating a mutable executable path race.
   core=stage/'knowledge_capture';body=imp.regular_absolute(core_path,64*1024*1024)
   require(imp.sha(body)==core_sha256,'core_digest_changed');core.write_bytes(body);core.chmod(0o700)
   expected=[]
   for cap in caps:
    remaining();path=verified[cap['path']]
    try:
     inspected=imp.parse(imp.run([core,'inspect',path],timeout=remaining()))
     require(inspected.get('archive_digest')==cap['archive_sha256'] and inspected.get('assertions')==cap['assertions'] and inspected.get('entities')==cap['sources'] and inspected.get('relationships')==cap['sources'],'native_inspection_count_or_digest_mismatch')
     data=capsule_data(path,cap,m,mapping)
     require(inspected.get('manifest')==data['manifest'],'inspection_manifest_mismatch');expected.append(data)
    except Exception as error:
     if isinstance(error,Refusal):
      error.capsule=error.capsule or cap['archive_sha256'];raise
     raise Refusal('native_preflight_refused',cap['archive_sha256'])from error
   for cap,data,record,limit in zip(caps,expected,envelope['records'],limits):
    child=dict(question=q['question'],known_as_of=q['known_as_of'],valid_at=q['valid_at'],time_mode=q['time_mode'],max_bytes=limit,revoked_sources=[])
    try:
     raw=imp.run([core,'reuse',verified[cap['path']]],imp.enc(child),limit=limit,timeout=remaining())
     record.update(validate_context(raw,cap,data,q,limit));record['native_max_bytes']=limit
    except Exception as error:
     if isinstance(error,Refusal):
      error.capsule=error.capsule or cap['archive_sha256'];raise
     reason=error.reason if isinstance(error,imp.ChildRefusal)and error.reason!='subprocess_refused' else 'native_child_query_refused'
     raise Refusal(reason,cap['archive_sha256'])from error
   envelope['coverage']['selected_claims']=sum(r['selected_claims']for r in envelope['records'])
   envelope['coverage']['selected_sources']=sum(r['selected_sources']for r in envelope['records'])
   remaining();encoded=imp.enc(envelope)+b'\n';require(len(encoded)<=q['max_bytes'],'final_global_budget_exceeded')
   return encoded
 finally:os.close(root_fd)


def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--collection',required=True);parser.add_argument('--request',required=True,help='explicit local JSON query file')
 parser.add_argument('--core',default=os.environ.get('TACITUS_KNOWLEDGE_CAPTURE_BIN'));parser.add_argument('--core-sha256',default=os.environ.get('TACITUS_KNOWLEDGE_CAPTURE_SHA256'))
 args=parser.parse_args();os.umask(0o077)
 def cancel(_signum,_frame):raise Refusal('collection_query_cancelled')
 for sig in(signal.SIGINT,signal.SIGTERM):signal.signal(sig,cancel)
 try:
  q=request(imp.regular_absolute(args.request,65536));raw=query_collection(args.collection,q,args.core,args.core_sha256)
 except Exception as error:
  failure=dict(format=ERROR,execution_complete=False,error=error.code if isinstance(error,Refusal)else'invalid_or_unavailable_collection')
  if isinstance(error,Refusal)and error.capsule:failure['capsule_archive_sha256']=error.capsule
  print(json.dumps(failure,sort_keys=True),file=sys.stderr);return 1
 sys.stdout.buffer.write(raw);return 0


if __name__=='__main__':sys.exit(main())
