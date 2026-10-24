#!/usr/bin/env python3
"""Regression checks for source teaching notes and generated-image caching."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from PIL import Image

spec = importlib.util.spec_from_file_location('story_importer', Path(__file__).with_name('build-endgame-stories.py'))
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class SavedOutcomeTests(unittest.TestCase):
    def test_finite_proofs_remain_separate_from_tablebase_responses(self):
        self.assertEqual(importer.saved_outcome(dict(method='finite_strategy', category_for_side_to_move='loss')), 'loss')
        self.assertEqual(importer.saved_outcome(dict(response=dict(category='draw'))), 'draw')
        with self.assertRaises(ValueError):
            importer.saved_outcome(dict(category_for_side_to_move='win'))


class SourceCorrectionTests(unittest.TestCase):
    def test_legacy_prose_and_structured_corrections_survive_import(self):
        structured = dict(claim='The move is mate.', correction='The king has a legal escape.')
        lesson = dict(video_id='test', sourceCorrections=['This continuation was not played.', structured])
        importer.normalize_source_corrections(lesson)
        self.assertEqual(lesson['sourceCorrections'], [
            dict(claim='Source clarification', correction='This continuation was not played.'), structured,
        ])
        importer.normalize_source_corrections(lesson)
        self.assertEqual(len(lesson['sourceCorrections']), 2)

    def test_malformed_corrections_fail_instead_of_disappearing_from_the_page(self):
        for correction in ['', {'claim': 'Missing explanation'}, None]:
            with self.subTest(correction=correction), self.assertRaises(ValueError):
                importer.normalize_source_corrections(dict(video_id='test', sourceCorrections=[correction]))


class ImageCacheTests(unittest.TestCase):
    def test_placeholder_metadata_does_not_hide_an_unreadable_cache_entry(self):
        with TemporaryDirectory() as directory:
            source = Path(directory) / 'board.jpg'
            target = Path(directory) / 'board.webp'
            Image.new('RGB', (800, 800), 'green').save(source)
            target.write_bytes(b'unreadable placeholder')
            original_stat = Path.stat

            def placeholder_stat(path, *args, **kwargs):
                actual = original_stat(path, *args, **kwargs)
                if path == target:
                    return SimpleNamespace(st_mode=actual.st_mode, st_mtime=source.stat().st_mtime + 100, st_flags=0x40000000)
                return actual

            with patch.object(Path, 'stat', placeholder_stat), patch.object(importer.stat, 'SF_DATALESS', 0x40000000, create=True):
                importer.image_task((source, target))
            with Image.open(target) as board:
                self.assertEqual(board.size, (384, 384))
                board.verify()
            self.assertFalse(target.with_name(target.name + '.tmp').exists())
            before = target.stat().st_mtime_ns
            importer.image_task((source, target))
            self.assertEqual(target.stat().st_mtime_ns, before)


if __name__ == '__main__':
    unittest.main()
