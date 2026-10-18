"""Offline evaluation boundaries; no network or model dependencies."""
import contextlib
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import shutil
import tempfile

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('eval_import_helpers', HERE.parent/'local-import/import_collection.py')
safe = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(safe)
enc, parse, sha = safe.enc, safe.parse, safe.sha
MAX_FILE = 16 * 1024 * 1024
DIMENSIONS = ('support', 'qualifications', 'uncertainty', 'task_response')
RUBRIC = {
    'format': 'tacitus-human-rubric/1', 'scale': [0, 1, 2, 3, 4],
    'anchors': {'0': 'Unacceptable or unsupported', '1': 'Major defects',
                '2': 'Mixed; material limitations', '3': 'Mostly sound; minor defects',
                '4': 'Sound for this question and supplied evidence'},
    'dimensions': {
        'support': 'Human judgment: answer claims supported by exact sources with correct attribution; citation mechanics alone are insufficient.',
        'qualifications': 'Human judgment: preserves modality, conditions, exceptions and conflicting evidence.',
        'uncertainty': 'Human judgment: honest unknown dates, omissions and appropriate abstention; no invented historical knowledge.',
        'task_response': 'Human judgment: useful response or justified abstention for the actual question, within evidence limits.'},
    'critical_failure': 'Human flag for unsupported certainty, fabricated citations or false verified-date claims. Preserve notes and disagreement.'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def fields(value, keys, name):
    require(isinstance(value, dict) and set(value) == set(keys), 'invalid '+name+' fields')


def text(value, name, maximum=2000):
    return safe.field(value, name, maximum)


def integer(value, low, high, name):
    require(type(value) is int and low <= value <= high, 'invalid '+name)


def digest(value):
    return isinstance(value, str) and re.fullmatch('[a-f0-9]{64}', value) is not None


def read(path, maximum=MAX_FILE):
    return safe.regular_absolute(path, maximum)


def load(path, maximum=MAX_FILE):
    return parse(read(path, maximum))


def implementation():
    paths = sorted(HERE.glob('*.py')) + [HERE/'cited-prompt-policy.json', HERE.parent/'local-import/import_collection.py']
    return {str(p.relative_to(HERE.parent)): sha(p.read_bytes()) for p in paths}


@contextlib.contextmanager
def fresh_directory(output):
    """Private FD-anchored staging; atomic no-replace publication on Linux."""
    out = Path(os.path.abspath(output))
    fd = safe.directory(out.parent)
    stage = None
    try:
        require(not os.path.lexists(out), 'fresh output directory required')
        stage = Path(tempfile.mkdtemp(prefix='.'+out.name+'.stage-', dir=f'/proc/self/fd/{fd}'))
        yield stage
        files = [p for p in stage.rglob('*') if p.is_file()]
        require(len(files) <= 1024 and sum(p.stat().st_size for p in files) <= 64*1024*1024,
                'output file/count bound exceeded')
        for p in files:
            with p.open('rb') as stream:
                os.fsync(stream.fileno())
        # Ordinary failure/SIGTERM cleanup is guaranteed; power-loss durability is not claimed.
        safe.publish(stage.name, out.name, fd)
    finally:
        if stage is not None and stage.exists():
            shutil.rmtree(stage)
        os.close(fd)


def write(root, name, raw):
    safe.relative(name)
    require(isinstance(raw, bytes) and len(raw) <= MAX_FILE, 'output file byte bound exceeded')
    p = root/name
    p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with p.open('xb') as stream:
        os.chmod(p, 0o600)
        stream.write(raw)


def write_json(root, name, value):
    write(root, name, enc(value)+b'\n')


def checked_snapshot(root, expected):
    """Expected full manifest digest is caller-owned; hashes are not authentication."""
    require(digest(expected), 'trusted experiment manifest SHA-256 required')
    fd = safe.directory(root)
    try:
        raw = safe.read_under(fd, 'manifest.json', 1024*1024)
        require(sha(raw) == expected, 'experiment manifest hash mismatch')
        manifest = parse(raw)
        require(manifest.get('format') == 'tacitus-offline-experiment/1', 'unsupported experiment')
        require(digest(manifest.get('experiment_id')) and isinstance(manifest.get('files'), dict), 'invalid experiment identity')
        require(len(manifest['files']) <= 1024, 'experiment file bound exceeded')
        data = {}
        total = 0
        for name, expected_hash in manifest['files'].items():
            require(name != 'manifest.json' and digest(expected_hash), 'invalid experiment inventory')
            value = safe.read_under(fd, name, MAX_FILE)
            total += len(value)
            require(total <= 64*1024*1024 and sha(value) == expected_hash, 'experiment file hash/size mismatch')
            data[name] = value
        # Refuse hidden extra files; read only inventoried bytes for all subsequent processing.
        allowed_files = set(data)|{'manifest.json'}
        allowed_dirs = set()
        for name in allowed_files:
            parts = name.split('/')
            allowed_dirs.update('/'.join(parts[:i]) for i in range(1,len(parts)))
        visits = 0
        def scan(current, prefix='', depth=0):
            nonlocal visits
            require(depth <= 8, 'experiment directory depth exceeded')
            result = set()
            with os.scandir(current) as entries:
                for entry in entries:
                    visits += 1
                    require(visits <= 2048, 'experiment directory entry bound exceeded')
                    name = prefix+entry.name
                    require(name in allowed_files or name in allowed_dirs, 'uninventoried experiment path')
                    require(not entry.is_symlink(), 'experiment symlink refused')
                    if entry.is_dir(follow_symlinks=False):
                        require(name in allowed_dirs, 'unexpected experiment directory')
                        child = os.open(entry.name, os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW, dir_fd=current)
                        try:
                            result |= scan(child, name+'/', depth+1)
                        finally:
                            os.close(child)
                    else:
                        result.add(name)
            return result
        require(scan(fd) == set(data)|{'manifest.json'}, 'uninventoried experiment file')
        return manifest, data
    finally:
        os.close(fd)
