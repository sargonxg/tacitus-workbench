#!/usr/bin/env python3
"""Linux-local, atomic explicit source import. No network, extraction or graph store."""
import argparse, copy, ctypes, errno, hashlib, io, json, os, pathlib, re
import selectors, shutil, signal, stat, subprocess, sys, tempfile, time, zipfile

HERE = pathlib.Path(__file__).absolute().parent
REPO = HERE.parent.parent
FORMAT = 'tacitus-local-import/1'
OUTPUT = 'tacitus-local-import-output/1'
LIMITS = dict(documents=256, source_bytes=32768, total_source_bytes=8*1024*1024,
              manifest_bytes=8*1024*1024, capture_bytes=1024*1024,
              capsule_bytes=1024*1024, native_sources=25, output_bytes=64*1024*1024)
PIN = '6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95'
UNREVIEWED = 'Unreviewed user-authored proposal; not independently established truth.'


def enc(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError('duplicate JSON key: ' + key)
        result[key] = value
    return result


def parse(raw):
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite JSON')))


def relative(name):
    if not isinstance(name, str) or not name or len(name.encode()) > 512:
        raise ValueError('bounded relative path required')
    parts = name.split('/')
    if len(parts) > 8 or any(p in ('', '.', '..') or '\\' in p or ':' in p or '\0' in p for p in parts):
        raise ValueError('unsafe relative path: ' + repr(name))
    return parts


def directory(path):
    """Open each ancestor without following symlinks; retain the final directory FD."""
    path = pathlib.Path(os.path.abspath(path))
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in path.parts[1:]:
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = nxt
        return fd
    except BaseException:
        os.close(fd)
        raise


def read_under(root_fd, name, limit):
    parts = relative(name)
    fd = os.dup(root_fd)
    try:
        for part in parts[:-1]:
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = nxt
        source = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
        try:
            info = os.fstat(source)
            if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
                raise ValueError('regular file exceeds bound: ' + name)
            with os.fdopen(source, 'rb', closefd=False) as stream:
                raw = stream.read(limit + 1)
            if len(raw) > limit:
                raise ValueError('file grew beyond bound: ' + name)
            return raw
        finally:
            os.close(source)
    finally:
        os.close(fd)


def regular_absolute(path, limit):
    p = pathlib.Path(os.path.abspath(path))
    fd = directory(p.parent)
    try:
        return read_under(fd, p.name, limit)
    finally:
        os.close(fd)


def field(value, name, maximum=2000):
    if not isinstance(value, str) or not value.strip() or '\0' in value or len(value.encode()) > maximum:
        raise ValueError(name + ' is required and bounded')
    return value


class ChildRefusal(ValueError):
    def __init__(self, name, reason='subprocess_refused'):
        self.reason=reason
        super().__init__('subprocess refused ('+name+')')


class NativeArchiveLimit(ValueError):
    pass


def run(args, input_raw=b'', limit=65536, timeout=10):
    """No shell/inherited credentials; bounded combined output, deadline and cancellation."""
    with tempfile.TemporaryFile() as stdin:
        stdin.write(input_raw)
        stdin.seek(0)
        p = subprocess.Popen([str(v) for v in args], stdin=stdin, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, env={})
        streams = selectors.DefaultSelector()
        streams.register(p.stdout, selectors.EVENT_READ, 'out')
        streams.register(p.stderr, selectors.EVENT_READ, 'err')
        chunks = {'out': [], 'err': []}
        size = 0
        end = time.monotonic() + timeout
        try:
            while streams.get_map():
                remaining = end - time.monotonic()
                if remaining <= 0:
                    raise ValueError('subprocess deadline exceeded')
                for key, _ in streams.select(min(remaining, .1)):
                    raw = os.read(key.fileobj.fileno(), 65536)
                    if not raw:
                        streams.unregister(key.fileobj)
                    else:
                        size += len(raw)
                        if size > limit:
                            raise ValueError('subprocess combined output limit')
                        chunks[key.data].append(raw)
            code = p.wait(timeout=max(.001, end - time.monotonic()))
            if code:
                if code == 75 and b''.join(chunks['err']) == b'batch_archive_limit\n' and not chunks['out']:
                    raise NativeArchiveLimit('native archive exceeds 1 MiB')
                # Never echo source-containing child diagnostics.
                message=b''.join(chunks['err']).lower()
                reason='subprocess_refused'
                for pattern,label in [(b'unknown validity','unknown_validity'),(b'strict date request','unknown_validity'),(b'graph revision unavailable','historical_revision_required'),(b'revoked source','revoked_source'),(b'capsule validity expired','capsule_expired'),(b'budget cannot hold','native_budget_insufficient')]:
                    if pattern in message:
                        reason=label
                        break
                raise ChildRefusal(pathlib.Path(args[0]).name,reason)
            return b''.join(chunks['out'])
        finally:
            if p.poll() is None:
                p.kill()
            p.wait()
            p.stdout.close()
            p.stderr.close()
            streams.close()


def executable(path, expected):
    if not path or not os.path.isabs(path) or not re.fullmatch('[a-f0-9]{64}', expected or ''):
        raise ValueError('absolute executable and SHA-256 required')
    if sha(regular_absolute(path, 64*1024*1024)) != expected:
        raise ValueError('executable SHA-256 mismatch')
    return path


def extract_adapter(stage):
    """Use the already shipped, checksum-pinned adapter; no private/prepared dependency."""
    base = REPO / 'examples/diplomacy-1914-v2'
    prep = __import__('importlib.util', fromlist=['']).spec_from_file_location('batch_example', base/'prepare_example.py')
    module = __import__('importlib.util', fromlist=['']).module_from_spec(prep)
    prep.loader.exec_module(module)
    raw = (base/'example-data.zip').read_bytes()
    if sha(raw) != module.ARCHIVE_SHA256:
        raise ValueError('shipped lexical bundle hash mismatch')
    checked = module.validate_archive(raw, parse((base/'DATA_MANIFEST.json').read_bytes()))
    target = stage / '.adapter'
    target.mkdir(mode=0o700)
    for name in ('collection.py', 'lexical_reference.py'):
        (target/name).write_bytes(checked['collection-adapter/'+name])
    return target


def producer_id():
    dependencies = [HERE/name for name in ('import_collection.py','author-captures.mjs','batch_author.rs','verify_previous_rows.py')]
    dependencies += [REPO/'apps/workbench'/name for name in ('src/local-author-client.mjs','server/local-author.mjs','server/local-inspector.mjs')]
    dependencies += [REPO/'examples/diplomacy-1914-v2'/name for name in ('example-data.zip','DATA_MANIFEST.json','prepare_example.py')]
    return sha(enc([(str(p.relative_to(REPO)),sha(p.read_bytes())) for p in dependencies]))


def previous_snapshot(path, stage, producer, collection):
    if not path:
        return None, None
    fd = directory(path)
    try:
        previous = parse(read_under(fd, 'manifest.json', 1024*1024))
        if (previous.get('format') != OUTPUT or previous.get('complete') is not True or
            previous.get('producer_sha256') != producer or previous.get('collection') != collection or
            not isinstance(previous.get('sources'), list) or len(previous['sources']) > LIMITS['documents'] or
            not isinstance(previous.get('files'), dict) or len(previous['files']) > 2048 or
            not isinstance(previous.get('lineage'), dict) or len(previous['lineage']) > 1024):
            raise ValueError('previous snapshot incompatible or incomplete')
        if previous.get('snapshot_sha256') != sha(enc(previous['sources'])):
            raise ValueError('previous snapshot identity mismatch')
        dest = stage / '.previous'
        dest.mkdir(mode=0o700)
        size = 0
        for name, digest in previous['files'].items():
            relative(name)
            if not re.fullmatch('[a-f0-9]{64}', digest):
                raise ValueError('invalid previous file digest')
            raw = read_under(fd, name, 2*1024*1024)
            size += len(raw)
            if size > LIMITS['output_bytes'] or sha(raw) != digest:
                raise ValueError('previous file bound or digest mismatch: ' + name)
            target = dest.joinpath(*relative(name))
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            target.write_bytes(raw)
        ids = [s['id'] for s in previous['sources']]
        if len(set(ids)) != len(ids):
            raise ValueError('duplicate previous source identity')
        return previous, dest
    finally:
        os.close(fd)


def declarations(manifest, fd, old, checkpoint):
    if (manifest.get('format') != FORMAT or set(manifest) != {'format','collection','author','sources'} or
        not isinstance(manifest['sources'], list) or not 1 <= len(manifest['sources']) <= LIMITS['documents']):
        raise ValueError('manifest requires 1..256 sources and exact format/collection/author/sources fields')
    field(manifest['collection'], 'collection', 200)
    field(manifest['author'], 'author', 200)
    prior = {s['id']: s for s in old['sources']} if old else {}
    entries, errors, keys, total = [], [], set(), 0
    for i, item in enumerate(manifest['sources']):
        try:
            if not isinstance(item, dict) or set(item) - {'key','path','sha256','title','author','provenance','rights','confirms_rights','language','authoring'}:
                raise ValueError('unsupported source declaration fields')
            key = field(item.get('key'), 'key', 200)
            if key in keys:
                raise ValueError('duplicate logical source key')
            keys.add(key)
            path = '/'.join(relative(item.get('path')))
            if pathlib.PurePosixPath(path).suffix.lower() not in ('.txt','.md','.markdown'):
                raise ValueError('only UTF-8 text/Markdown supported; no PDF/OCR/archive/URL')
            raw = read_under(fd, path, LIMITS['source_bytes'])
            text = raw.decode('utf-8')
            if not text.strip() or '\0' in text or text.encode() != raw:
                raise ValueError('nonempty exact UTF-8 without NUL required')
            if sha(raw) != item.get('sha256'):
                raise ValueError('declared source hash mismatch')
            for k, cap in [('title',200),('author',200),('provenance',1000),('rights',2000),('language',32)]:
                field(item.get(k), k, cap)
            if item.get('confirms_rights') is not True:
                raise ValueError('explicit rights declaration required')
            if 'authoring' in item:
                a=item['authoring']
                if not isinstance(a,dict) or set(a)!={'annotationAuthor','entityKind','entityLabel','relation','direction','rationale','annotations'}:
                    raise ValueError('authoring requires exact explicit annotationAuthor/entityKind/entityLabel/relation/direction/rationale/annotations fields')
                if not isinstance(a['annotations'],list) or len(a['annotations'])!=2 or any(not isinstance(v,dict) or set(v)!={'quote','proposition','speaker','modality','conditions','exceptions'} for v in a['annotations']):
                    raise ValueError('exactly two fully declared reported-statement annotations required')
            total += len(raw)
            if total > LIMITS['total_source_bytes']:
                raise ValueError('collection source bytes exceed 8 MiB')
            identity = 's-' + sha(enc([manifest['collection'], key]))
            content = {k: v for k,v in item.items() if k != 'path'}
            revision = sha(enc(content))
            previous = prior.get(identity)
            historical = previous or (old.get('lineage',{}).get(identity) if old else None)
            same = previous and previous['revision'] == revision
            version = previous['version'] if same else (historical['version']+1 if historical else 1)
            recorded = previous['checkpoint'] if same else checkpoint
            if type(version) is not int or not 1 <= version <= 2147483647 or type(recorded) is not int or not 0 <= recorded <= checkpoint:
                raise ValueError('previous version/checkpoint invalid or after requested checkpoint')
            entries.append(dict(id=identity, key=key, revision=revision, version=version,
                                checkpoint=recorded, text=text, declaration=item,
                                semantic_status='unreviewed explicitly authored proposals' if 'authoring' in item else 'no semantic assertions authored'))
        except (ValueError, OSError, UnicodeError, KeyError, TypeError) as error:
            errors.append({'source_index': i, 'error': str(error)})
    if errors:
        raise ValueError(json.dumps({'complete':False,'source_errors':errors}, ensure_ascii=True))
    return sorted(entries, key=lambda e: e['id'])


def lexical_document(e):
    s, text = e['declaration'], e['text']
    return dict(id=e['id'], text=text, text_sha256=sha(text.encode()), text_bytes=len(text.encode()),
                title=s['title'], author=s['author'], provenance=s['provenance'], language=s['language'],
                rights_id=s['rights'], rights_url=s['provenance'], rights_verified=False,
                historical_availability_warning='Publication/receipt/world validity unknown; modern local ingestion only.',
                document_date=None, recipient_received_calendar_date=None, source_family='user-supplied-local-text',
                semantic_status=e['semantic_status'], annotation_author=s.get('authoring',{}).get('annotationAuthor'), unreviewed=True,
                blocks=[dict(id=e['id']+'-full',start=0,end=len(text.encode()),text=text,
                             locator='Exact full UTF-8 source bytes',kind='untrusted source text; no inferred assertion')])


def combine(items, author, collection):
    captures = [x['capture'] for x in items]
    c = copy.deepcopy(captures[0])
    checkpoint = max(x['manifest']['created_at'] for x in captures)
    c['documents'] = [d for x in captures for d in x['documents']]
    c['assertions'] = [a for x in captures for a in x['assertions']]
    c['observed_at'] = {k:v for x in captures for k,v in x['observed_at'].items()}
    g = c['graph']
    g['available_at'] = checkpoint
    g['nodes'] = {k:v for x in captures for k,v in x['graph']['nodes'].items()}
    g['links'] = [link for x in captures for link in x['graph']['links']]
    m = c['manifest']
    identity = sha(enc([x['id'] for x in items]))
    m.update(id='batch-'+identity, author=author, title=collection, created_at=checkpoint,
             license='Per-source user declarations retained in source records; rights not verified.',
             limitations=['Explicit user-authored unreviewed proposals; no automatic extraction or semantic approval.',
                          'Only sources with explicit annotations are in this bounded capsule; collection manifest lists all sources.',
                          'Private metadata is not encryption. Full source bytes included. Unknown historical/world dates.'] +
                         ['Unverified annotation authorship declaration: '+enc({'source':x['documents'][0]['id']+'@'+str(x['documents'][0]['version']),'annotation_author':x['manifest']['author']}).decode() for x in captures])
    return {'capture':c,'quotes':[q for x in items for q in x['quotes']]}


def check_native(archive, payload, core):
    """Bind a reused ZIP to freshly reconstructed declarations, beyond self-reported hashes."""
    raw = archive.read_bytes()
    if len(raw) > LIMITS['capsule_bytes']:
        raise ValueError('capsule exceeds 1 MiB')
    run([core,'inspect',archive])
    c = payload['capture']
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        members = z.infolist()
        if len(members) > 64 or len({m.filename for m in members}) != len(members) or sum(m.file_size for m in members) > 8*1024*1024 or any(m.file_size > 2*1024*1024 for m in members):
            raise ValueError('capsule archive resource bound')
        data = parse(z.read('capsule.json'))
        expected_docs = [{**d,'text':''} for d in c['documents']]
        if data['sources'] != expected_docs or data['assertions'] != c['assertions'] or data['methods'] or data['reviews']:
            raise ValueError('capsule declarations differ from current input')
        sidecar = parse(data['artifacts']['tacitus.uploaded-knowledge/1'])
        graph = dict(sidecar['graph'])
        graph.pop('claim_fingerprints')
        expected_graph = dict(c['graph'])
        expected_graph.pop('claim_fingerprints')
        if graph != expected_graph or sidecar['observed_at'] != c['observed_at'] or sidecar['extractor'] != c['extractor']:
            raise ValueError('capsule graph/observation differs from current input')
        m = parse(z.read('manifest.json'))
        m['files'] = {}
        if m != c['manifest']:
            raise ValueError('capsule manifest differs from current input')
        for d in c['documents']:
            name = 'evidence/'+sha((d['id']+'@'+str(d['version'])).encode())+'.txt'
            if z.read(name) != d['text'].encode():
                raise ValueError('capsule full source bytes differ')


def publish(stage_name, output_name, parent_fd):
    # Atomic no-replace commit point. Refuse platforms lacking the Linux primitive.
    libc = ctypes.CDLL(None, use_errno=True)
    if not hasattr(libc, 'renameat2'):
        raise ValueError('atomic no-replace publication requires Linux renameat2')
    if libc.renameat2(parent_fd, os.fsencode(stage_name), parent_fd, os.fsencode(output_name), 1):
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code))
    os.fsync(parent_fd)


def build(args):
    root_fd = directory(args.root)
    out = pathlib.Path(os.path.abspath(args.output))
    parent_fd = directory(out.parent)
    stage_name = None
    try:
        if os.path.lexists(out):
            raise ValueError('fresh output required; existing output is never modified')
        raw = read_under(root_fd, args.manifest, LIMITS['manifest_bytes'])
        manifest = parse(raw)
        field(manifest.get('collection'), 'collection', 200)
        field(manifest.get('author'), 'author', 200)
        checkpoint = args.checkpoint if args.checkpoint is not None else int(time.time())
        if type(checkpoint) is not int or not 0 <= checkpoint <= int(time.time())+300:
            raise ValueError('bounded nonfuture checkpoint required')
        # Pin parent by FD even if an ancestor is renamed during the build.
        stage = pathlib.Path(tempfile.mkdtemp(prefix='.'+out.name+'.stage-', dir='/proc/self/fd/'+str(parent_fd)))
        stage_name = stage.name
        stage = pathlib.Path('/proc')/str(os.getpid())/'fd'/str(parent_fd)/stage_name
        producer = producer_id()
        old, prior = previous_snapshot(args.previous, stage, producer, manifest['collection'])
        entries = declarations(manifest, root_fd, old, checkpoint)
        authored = [e for e in entries if 'authoring' in e['declaration']]
        core = helper = None
        if authored:
            helper = executable(args.helper, args.helper_sha256)
            core = executable(args.core, args.core_sha256)
        adapter = extract_adapter(stage)
        corpus = {'format':'tacitus-source-corpus-index/1','documents':[lexical_document(e) for e in entries]}
        corpus_raw = enc(corpus)
        if len(corpus_raw) > 32*1024*1024:
            raise ValueError('lexical corpus exceeds existing 32 MiB input bound')
        (stage/'corpus.json').write_bytes(corpus_raw)
        previous_index = prior/'lexical' if prior else None
        lexical_args = [sys.executable,adapter/'collection.py','build',stage/'corpus.json',stage/'lexical']
        if previous_index:
            run([sys.executable,HERE/'verify_previous_rows.py',adapter,stage/'corpus.json',previous_index])
            lexical_args += ['--previous',previous_index]
        lexical_receipt = parse(run(lexical_args))
        captures = []
        if authored:
            node = shutil.which('node')
            if not node:
                raise ValueError('Node24 required for existing authoring contract')
            annotation_errors=[]
            for offset in range(0,len(authored),25):
                part=parse(run([node,HERE/'author-captures.mjs'],enc(authored[offset:offset+25]),limit=16*1024*1024))
                if isinstance(part,dict):
                    annotation_errors.extend(part.get('errors',[]))
                else:
                    captures.extend(part)
            if annotation_errors:
                raise ValueError(json.dumps({'complete':False,'annotation_errors':annotation_errors},ensure_ascii=True))
        chunks, chunk = [], []
        for item in captures:
            candidate = chunk+[item]
            if chunk and (len(candidate)>LIMITS['native_sources'] or len(enc(combine(candidate,manifest['author'],manifest['collection'])))>LIMITS['capture_bytes']):
                chunks.append(chunk)
                chunk = []
            chunk.append(item)
            if len(enc(combine(chunk,manifest['author'],manifest['collection']))) > LIMITS['capture_bytes']:
                raise ValueError('individual authored source exceeds native capture byte bound')
        if chunk:
            chunks.append(chunk)
        (stage/'native').mkdir(mode=0o700)
        native, reused = [], 0
        old_caps = {x['input_sha256']:x for x in old.get('native_capsules',[]) } if old else {}
        pending=list(chunks)
        while pending:
            chunk=pending.pop(0)
            payload = combine(chunk,manifest['author'],manifest['collection'])
            input_raw = enc(payload)
            digest = sha(input_raw)
            name = 'native/'+digest+'.zip'
            target = stage/name
            cached = old_caps.get(digest)
            if cached and old.get('helper_sha256') == args.helper_sha256 and old.get('core_sha256') == args.core_sha256:
                expected_name = 'native/'+digest+'.zip'
                if cached.get('path') != expected_name or expected_name not in old['files']:
                    raise ValueError('previous capsule path is not content addressed')
                target.write_bytes((prior/expected_name).read_bytes())
                reused += 1
            else:
                temp = stage/'.capture.json'
                temp.write_bytes(input_raw)
                try:
                    run([helper,temp,target])
                except NativeArchiveLimit:
                    if target.exists() or target.is_symlink():
                        raise ValueError('unexpected archive output on native resource refusal')
                    temp.unlink()
                    if len(chunk)==1:
                        raise ValueError('single authored source exceeds native archive bound: '+chunk[0]['id'])
                    middle=len(chunk)//2
                    pending[0:0]=[chunk[:middle],chunk[middle:]]
                    continue
                except ValueError as error:
                    raise ValueError('native shard refused for source IDs '+','.join(x['id'] for x in chunk)+': '+str(error)) from error
                temp.unlink()
            check_native(target,payload,core)
            native.append(dict(path=name,input_sha256=digest,archive_sha256=sha(target.read_bytes()),
                               source_ids=[x['id'] for x in chunk],sources=len(chunk),assertions=len(chunk)*2,
                               checkpoint=payload['capture']['manifest']['created_at']))
        sources = [{k:e[k] for k in ('id','key','revision','version','checkpoint','semantic_status')} |
                   {'text_sha256':e['declaration']['sha256'],'annotation_author':e['declaration'].get('authoring',{}).get('annotationAuthor')} for e in entries]
        oldmap = {e['id']:e for e in old['sources']} if old else {}
        current = {e['id']:e for e in sources}
        tombstones = [{'id':sid,'revision':e['revision'],'version':e['version'],'reason':'removed' if sid not in current else 'replaced'}
                      for sid,e in sorted(oldmap.items()) if sid not in current or current[sid]['revision'] != e['revision']]
        lineage = copy.deepcopy(old['lineage']) if old else {}
        lineage.update({e['id']:{k:e[k] for k in ('version','revision','checkpoint')} for e in sources})
        if len(lineage)>1024:
            raise ValueError('lineage exceeds 1024 retained logical identities; start a separately named collection explicitly')
        hashes = {}
        for e in sources:
            hashes.setdefault(e['text_sha256'],[]).append(e['id'])
        duplicates = [ids for _,ids in sorted(hashes.items()) if len(ids)>1]
        # Bundle the unchanged existing lexical consumer; no dependency on prepared examples.
        (stage/'query').mkdir(mode=0o700)
        for name in ('collection.py','lexical_reference.py'):
            shutil.copyfile(adapter/name,stage/'query'/name)
        shutil.rmtree(adapter)
        if prior:
            shutil.rmtree(prior)
        (stage/'corpus.json').unlink()
        files, total = {}, 0
        for p in sorted(stage.rglob('*')):
            if p.is_symlink():
                raise ValueError('unexpected output symlink')
            if p.is_file():
                body = p.read_bytes()
                total += len(body)
                if len(body)>2*1024*1024 or total>LIMITS['output_bytes']:
                    raise ValueError('output file/collection byte limit exceeded')
                files[str(p.relative_to(stage))] = sha(body)
                os.chmod(p,0o600)
                with p.open('rb') as f:
                    os.fsync(f.fileno())
        snapshot = sha(enc(sources))
        result = dict(format=OUTPUT,complete=True,collection=manifest['collection'],author=manifest['author'],
                      producer_sha256=producer,core_pin=PIN,helper_sha256=args.helper_sha256 if authored else None,
                      core_sha256=args.core_sha256 if authored else None,sources=sources,snapshot_sha256=snapshot,
                      native_capsules=native,lineage=lineage,source_only_ids=[e['id'] for e in sources if e['semantic_status']=='no semantic assertions authored'],
                      duplicate_content_groups=duplicates,files=files,
                      parent_snapshot=old['snapshot_sha256'] if old and snapshot!=old['snapshot_sha256'] else (old.get('parent_snapshot') if old else None),
                      tombstones=tombstones if not old or snapshot!=old['snapshot_sha256'] else old['tombstones'],
                      limits=LIMITS,limitations=['Unreviewed declarations; no factual extraction or rights/truth/semantic verification.',
                         'Lexical index covers all declared sources; native capsules include only explicitly authored sources.',
                         'No combined cross-capsule native query or cross-document inferred relations.',
                         'Private local files are not encryption. Full source bytes are included.'])
        result_raw = enc(result)
        if len(result_raw)>1024*1024:
            raise ValueError('output manifest exceeds 1 MiB')
        (stage/'manifest.json').write_bytes(result_raw)
        os.chmod(stage/'manifest.json',0o600)
        with (stage/'manifest.json').open('rb') as f:
            os.fsync(f.fileno())
        # Sync nested directory entries before the final rename.
        for p in sorted([p for p in stage.rglob('*') if p.is_dir()],key=lambda p:len(p.parts),reverse=True)+[stage]:
            fd = os.open(p,os.O_RDONLY|os.O_DIRECTORY)
            os.fsync(fd)
            os.close(fd)
        publish(stage_name,out.name,parent_fd)
        stage_name = None
        return dict(complete=True,snapshot_sha256=snapshot,sources=len(sources),
                    source_only=len(result['source_only_ids']),native_capsules=len(native),
                    authored_sources=len(authored),native_assertions=len(authored)*2,
                    reused_native_capsules=reused,duplicate_content_groups=len(duplicates),
                    lexical_receipt=lexical_receipt,tombstones=tombstones)
    finally:
        if stage_name:
            shutil.rmtree('/proc/self/fd/'+str(parent_fd)+'/'+stage_name,ignore_errors=True)
        os.close(root_fd)
        os.close(parent_fd)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',required=True,help='existing source root; symlinks refused')
    p.add_argument('--manifest',required=True,help='relative JSON manifest beneath root')
    p.add_argument('--output',required=True,help='fresh output; existing real parent directory')
    p.add_argument('--previous',help='explicit previous complete output; fully hash verified')
    p.add_argument('--checkpoint',type=int,help='reproducible modern checkpoint; default current UTC seconds')
    p.add_argument('--helper',default=os.environ.get('TACITUS_BATCH_AUTHOR_BIN'))
    p.add_argument('--helper-sha256',default=os.environ.get('TACITUS_BATCH_AUTHOR_SHA256'))
    p.add_argument('--core',default=os.environ.get('TACITUS_KNOWLEDGE_CAPTURE_BIN'))
    p.add_argument('--core-sha256',default=os.environ.get('TACITUS_KNOWLEDGE_CAPTURE_SHA256'))
    args = p.parse_args()
    def cancel(_signum,_frame):
        raise InterruptedError('import interrupted; no complete output published')
    for sig in (signal.SIGINT,signal.SIGTERM):
        signal.signal(sig,cancel)
    os.umask(0o077)
    try:
        result = build(args)
    except (Exception, KeyboardInterrupt) as error:
        print(json.dumps({'complete':False,'error':str(error)},ensure_ascii=True),file=sys.stderr)
        return 1
    print(json.dumps(result,ensure_ascii=True,sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
