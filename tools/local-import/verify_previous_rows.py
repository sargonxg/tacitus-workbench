"""Reconstruct every reused lexical row from current exact source text and tokenizer."""
import importlib.util, pathlib, sys
adapter, corpus_path, previous_path = map(pathlib.Path, sys.argv[1:])
spec = importlib.util.spec_from_file_location('verified_collection', adapter/'collection.py')
module = importlib.util.module_from_spec(spec)
sys.path.insert(0,str(adapter))
spec.loader.exec_module(module)
corpus = module.read(corpus_path)
expected = {}
for raw in corpus['documents']:
    doc = module.source(raw)
    revision = module.sha(module.enc(doc))
    expected[doc['id']] = dict(id=doc['id'],revision=revision,blocks=[
        dict(id=b['id'],start=b['start'],end=b['end'],terms=sorted(module.tokens(b['text'])))
        for b in doc['blocks']])
previous = module.load_manifest(previous_path)
verified = 0
for desc in previous['shards']:
    body = (previous_path/'shards'/(desc['sha256']+'.json')).read_bytes()
    if module.sha(body) != desc['sha256']:
        raise ValueError('previous shard digest mismatch')
    for row in module.read(previous_path/'shards'/(desc['sha256']+'.json')):
        current = expected.get(row['id'])
        if current and current['revision'] == row['revision']:
            if row != current:
                raise ValueError('cached lexical row differs from exact current source/tokenizer')
            verified += 1
print(verified)
