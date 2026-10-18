#!/usr/bin/env python3
"""Derive the small public guide fixture from verified, already shipped examples."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'apps/workbench/public/examples'


def bundle(name):
    directory = ROOT / 'examples' / name
    helper = runpy.run_path(str(directory / 'prepare_example.py'))
    raw = (directory / 'example-data.zip').read_bytes()
    if hashlib.sha256(raw).hexdigest() != helper['ARCHIVE_SHA256']:
        raise ValueError('source bundle hash mismatch: ' + name)
    manifest = json.loads((directory / 'DATA_MANIFEST.json').read_text())
    return helper['validate_archive'](raw, manifest)


def outputs():
    july = bundle('july-1914')
    expanded = bundle('diplomacy-1914-v2')
    corpus = json.loads(expanded['corpus-index.json'])
    documents = corpus['documents']
    facts = {'format': 'tacitus-workbench-onboarding/1', 'collection': {
        'records': len(documents),
        'publisher_records': sum(d['source_kind'] != 'retrospective_memoir_section' for d in documents),
        'retrospective_sections': sum(d['source_kind'] == 'retrospective_memoir_section' for d in documents),
    }, 'capsules': {}}
    files = {}
    for key, source, capture_path, filename, question, checkpoint in [
        ('july', july, 'annotations/capture.json', 'july-1914.native-v2.zip', 'peace', 1792328100),
        ('expanded', expanded, 'annotations/expanded/capture.json', 'expanded-cases.native-v2.zip', 'relief assurance', 1792332960),
    ]:
        capture = json.loads(source[capture_path])
        raw = source[filename]
        outer = ROOT / 'examples' / ('july-1914' if key == 'july' else 'diplomacy-1914-v2') / filename
        if raw != outer.read_bytes():
            raise ValueError('native archive differs from verified bundle')
        files[filename] = raw
        facts['capsules'][key] = {'sources': len(capture['documents']),
            'unreviewed_assertions': len(capture['assertions']), 'href': '/examples/' + filename,
            'sha256': hashlib.sha256(raw).hexdigest(), 'question': question, 'checkpoint': checkpoint}
    files['onboarding-facts.json'] = (json.dumps(facts, indent=2) + '\n').encode()
    return files


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name, raw in outputs().items():
        path = PUBLIC / name
        if args.check:
            if path.read_bytes() != raw:
                raise ValueError('stale onboarding deliverable: ' + name)
        else:
            path.write_bytes(raw)
    print('Guide facts and native downloads match the verified public source bundles.')
