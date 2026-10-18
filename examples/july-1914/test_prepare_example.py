#!/usr/bin/env python3
"""Safe expansion tests; only synthetic archives, no network."""
import hashlib
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
import warnings
import zipfile
from unittest.mock import patch
import prepare_example as p


def fixture(entries):
    raw = io.BytesIO()
    records = []
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', UserWarning)
        with zipfile.ZipFile(raw, 'w') as archive:
            for name, content, mode in entries:
                info = zipfile.ZipInfo(p.PREFIX + name)
                info.external_attr = mode << 16
                archive.writestr(info, content)
                records.append({'path': name, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
    return raw.getvalue(), {'root': p.PREFIX, 'files': records}


class PreparationTests(unittest.TestCase):
    def test_regular_file(self):
        raw, manifest = fixture([('texts/a.txt', b'hello', stat.S_IFREG | 0o644)])
        self.assertEqual(p.validate_archive(raw, manifest), {'texts/a.txt': b'hello'})

    def test_unsafe_paths(self):
        for name in ('../escape', '/absolute', 'a/../../escape', 'a\\escape', 'C:/escape', 'a//b', './a', 'a/./b'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                raw, manifest = fixture([(name, b'x', 0o644)])
                p.validate_archive(raw, manifest)

    def test_duplicate_members(self):
        raw, manifest = fixture([('x', b'a', 0o644), ('x', b'b', 0o644)])
        with self.assertRaises(ValueError):
            p.validate_archive(raw, manifest)

    def test_duplicate_archive_even_if_manifest_has_distinct_paths(self):
        raw, manifest = fixture([('x', b'a', 0o644), ('x', b'a', 0o644)])
        manifest['files'][1]['path'] = 'y'
        with self.assertRaises(ValueError):
            p.validate_archive(raw, manifest)

    def test_nonregular_entries(self):
        for mode in (stat.S_IFLNK | 0o777, stat.S_IFDIR | 0o755, stat.S_IFCHR | 0o600):
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                raw, manifest = fixture([('x', b'outside', mode)])
                p.validate_archive(raw, manifest)

    def test_unlisted_missing_and_bad_hash(self):
        raw, manifest = fixture([('x', b'a', 0o644)])
        manifest['files'][0]['path'] = 'y'
        with self.assertRaises(ValueError):
            p.validate_archive(raw, manifest)
        manifest['files'][0]['path'] = 'x'
        manifest['files'][0]['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            p.validate_archive(raw, manifest)

    def test_oversize_limits(self):
        raw, manifest = fixture([('x', b'abc', 0o644)])
        for limit, value in (('MAX_ARCHIVE', 1), ('MAX_FILE', 2), ('MAX_TOTAL', 2), ('MAX_FILES', 0)):
            with self.subTest(limit=limit), patch.object(p, limit, value), self.assertRaises(ValueError):
                p.validate_archive(raw, manifest)

    def test_existing_output_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                p.expand(Path(directory))
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_dangling_symlink_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'link'
            output.symlink_to(Path(directory) / 'absent')
            with self.assertRaises(ValueError):
                p.expand(output)
            self.assertTrue(output.is_symlink())

    def test_archive_tamper_refused_before_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'tampered.zip'
            archive.write_bytes(b'not the pinned archive')
            with self.assertRaises(ValueError):
                p.expand(root / 'out', archive)
            self.assertFalse((root / 'out').exists())

    def test_shipped_archive_identity_and_full_expansion(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'out'
            receipt = p.expand(output)
            self.assertEqual(receipt['files'], 209)
            self.assertEqual(hashlib.sha256((output / 'july-1914.native-v2.zip').read_bytes()).hexdigest(), 'c7268bef3b19ff9b93458a64e476dd52df1c76f074e77fe149d2983268a66e5f')
            self.assertFalse((output / 'upstream/lichnowsky-catalog.html').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
