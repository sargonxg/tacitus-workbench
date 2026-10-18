#!/usr/bin/env python3
"""Verify and unpack this pinned example locally; no network or code execution."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import zipfile

ROOT = Path(__file__).resolve().parent
ARCHIVE_SHA256 = 'a5dd21b2edc4850b0c155c5fb33c803e838c3c47edeae148379af4e227cac0aa'
PREFIX = 'diplomacy-1914-expanded/'
MAX_ARCHIVE = 16 * 1024 * 1024
MAX_FILE = 16 * 1024 * 1024
MAX_TOTAL = 32 * 1024 * 1024
MAX_FILES = 1024


def safe_name(name):
    if not isinstance(name, str) or not name or '\\' in name or '\x00' in name:
        raise ValueError('invalid entry path')
    parts = name.split('/')
    if any(p in ('', '.', '..') or ':' in p for p in parts):
        raise ValueError('unsafe entry path: ' + name)
    if PurePosixPath(name).is_absolute():
        raise ValueError('absolute entry path')
    return name


def validate_archive(raw, manifest):
    """Return checked regular file bytes. This helper is testable with synthetic ZIPs."""
    if len(raw) > MAX_ARCHIVE:
        raise ValueError('archive too large')
    if manifest.get('root') != PREFIX:
        raise ValueError('unexpected archive root')
    records = manifest.get('files', [])
    if not 0 < len(records) <= MAX_FILES:
        raise ValueError('invalid manifest file count')
    expected = {}
    for record in records:
        name = safe_name(record['path'])
        if name in expected:
            raise ValueError('duplicate manifest path')
        size = record['bytes']
        if type(size) is not int or not 0 <= size <= MAX_FILE:
            raise ValueError('invalid manifest file size')
        expected[name] = record
    if sum(r['bytes'] for r in expected.values()) > MAX_TOTAL:
        raise ValueError('manifest total too large')
    checked = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        members = archive.infolist()
        if len(members) != len(expected) or len(members) > MAX_FILES:
            raise ValueError('archive file count differs from manifest')
        total = 0
        for member in members:
            if not member.filename.startswith(PREFIX):
                raise ValueError('unexpected entry root')
            name = safe_name(member.filename[len(PREFIX):])
            if name in checked or name not in expected:
                raise ValueError('duplicate or unlisted archive entry')
            kind = stat.S_IFMT(member.external_attr >> 16)
            if member.is_dir() or kind not in (0, stat.S_IFREG):
                raise ValueError('only regular files are allowed')
            if member.flag_bits & 1:
                raise ValueError('encrypted entries are not allowed')
            total += member.file_size
            if member.file_size > MAX_FILE or total > MAX_TOTAL:
                raise ValueError('uncompressed content too large')
            if member.file_size != expected[name]['bytes']:
                raise ValueError('entry size differs from manifest')
            with archive.open(member) as stream:
                content = stream.read(MAX_FILE + 1)
            if len(content) != member.file_size:
                raise ValueError('actual entry size differs')
            if hashlib.sha256(content).hexdigest() != expected[name]['sha256']:
                raise ValueError('entry hash differs: ' + name)
            checked[name] = content
    if checked.keys() != expected.keys():
        raise ValueError('missing entry')
    return checked


def expand(output, archive_path=ROOT / 'example-data.zip', manifest_path=ROOT / 'DATA_MANIFEST.json'):
    output = Path(output).absolute()
    if os.path.lexists(output):
        raise ValueError('output must not already exist (including symlinks)')
    if not output.parent.is_dir():
        raise ValueError('output parent must already be a directory')
    if archive_path.stat().st_size > MAX_ARCHIVE:
        raise ValueError('archive too large')
    raw = archive_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != ARCHIVE_SHA256:
        raise ValueError('pinned archive SHA-256 mismatch')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('archive_sha256') != ARCHIVE_SHA256 or manifest.get('archive_bytes') != len(raw):
        raise ValueError('manifest archive identity differs')
    checked = validate_archive(raw, manifest)
    # All archive data is checked before writing. Use a fresh, privately writable directory.
    output.mkdir(mode=0o700)
    try:
        for name, content in checked.items():
            destination = output.joinpath(*name.split('/'))
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as stream:
                stream.write(content)
    except BaseException:
        shutil.rmtree(output)
        raise
    return {'files': len(checked), 'bytes': sum(map(len, checked.values())), 'output': str(output),
            'archive_sha256': ARCHIVE_SHA256, 'executed_code': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.data', help='new output directory; default: .data beside this script')
    args = parser.parse_args()
    try:
        print(json.dumps(expand(args.output), indent=2))
    except (ValueError, OSError, KeyError, TypeError, zipfile.BadZipFile) as error:
        parser.exit(1, 'Refused: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
