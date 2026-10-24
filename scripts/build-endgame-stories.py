#!/usr/bin/env python3
"""Import the local Pietro extraction as attributed source walkthroughs.

Usage: python build-endgame-stories.py /path/to/pietro-checkmate-shorts
Requires Pillow. Only curated lessons contain verified FENs/variations;
the rest preserve source narration and snapshots without inventing chess moves.
"""
import argparse
import csv
import hashlib
import html
import json
import os
import re
import stat
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / 'apps/web/public/endgame-stories'
DATA = PROJECT / 'apps/web/src/stories/data'
THEMES = {
    'Promotion': r'promot|underpromot',
    'Zugzwang': r'zugzwang',
    'Stalemate': r'stalemate',
    'King routes': r'opposition|king.{0,25}(?:march|walk|route|shelter)|(?:march|walk).{0,25}king',
    'Sacrifice': r'sacrific',
    'Rook defense': r'rook.{0,40}(?:check|defen)|(?:check|defen).{0,40}rook',
    'Coordination': r'coordinat|skewer|fortress|shield',
}


def saved_outcome(evidence):
    if 'response' in evidence:
        return evidence['response']['category']
    if evidence.get('method') in ['finite_strategy', 'finite_draw']:
        return evidence['category_for_side_to_move']
    raise ValueError('Unsupported saved outcome evidence')


def clean(text):
    return re.sub(r'\s+', ' ', html.unescape(text)).strip()


def normalize_source_corrections(lesson):
    """Keep legacy prose corrections visible under the web's object contract."""
    corrections = []
    for correction in lesson.get('sourceCorrections', []):
        if isinstance(correction, str):
            correction = dict(claim='Source clarification', correction=correction)
        if not isinstance(correction, dict) or not isinstance(correction.get('correction'), str) or not correction['correction'].strip():
            raise ValueError(f'Invalid source correction: {lesson.get("video_id")}')
        corrections.append(correction)
    lesson['sourceCorrections'] = corrections


def merge(texts):
    result = []
    for text in texts:
        words = clean(text).split()
        overlap = 0
        for size in range(min(len(result), len(words)), 0, -1):
            if [w.lower() for w in result[-size:]] == [w.lower() for w in words[:size]]:
                overlap = size
                break
        result.extend(words[overlap:])
    return ' '.join(result)


def image_task(task):
    source, target = task
    if target.exists():
        cached = target.stat()
        # iCloud placeholders have a size and mtime but no locally readable data.
        dataless = getattr(cached, 'st_flags', 0) & getattr(stat, 'SF_DATALESS', 0)
        if not dataless and cached.st_mtime >= source.stat().st_mtime:
            return
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.tmp')
    try:
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original).convert('RGB')
            image.thumbnail((384, 384))
            image.save(temporary, 'WEBP', quality=64, method=4)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def load_reviews(batch_paths, curated):
    reviews = {}
    statuses = {'verified_selected_lines', 'awaiting_reconstruction', 'needs_information', 'not_applicable'}
    for batch_path in batch_paths:
        batch = json.loads(batch_path.read_text())
        for vid, review in batch['reviews'].items():
            if review['result'] not in statuses:
                raise ValueError(f'Unknown review status: {vid}')
            previous = reviews.get(vid)
            if previous and review.get('supersedes_batch') != previous['batch_id']:
                raise ValueError(f'Review must explicitly supersede {previous["batch_id"]}: {vid}')
            if review['result'] == 'verified_selected_lines' and vid not in curated:
                raise ValueError(f'Review has no checked study: {vid}')
            history = [] if not previous else previous['history'] + [{key: previous.get(key) for key in ['batch_id', 'reviewed_on', 'result', 'notes', 'analysis_required', 'information_needed']}]
            reviews[vid] = dict(review, batch_id=batch['batch_id'], reviewed_on=batch['reviewed_on'], history=history)
    return reviews


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source', type=Path)
    args = ap.parse_args()
    source = args.source.resolve()
    extraction = source / 'work/board_v3'
    OUT.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    entries = json.loads((source / 'shorts.json').read_text())['entries']
    curated = {}
    for vid in ['KEnJIrhWSDQ', 'NysivKCHQiY']:
        lesson = json.loads((extraction / 'lessons' / (vid + '.json')).read_text())
        evidence = json.loads((extraction / 'lessons/tablebase_evidence.json').read_text())
        for branch in lesson['branches']:
            key = vid + ':branch:' + branch['id']
            branch['outcome'] = evidence[key]['response']['category']
        curated[vid] = lesson
    # Additional reviewed studies live with this project; importing the channel
    # must not discard their checked positions, teaching notes or provenance.
    for path in sorted((PROJECT / 'scripts/curated-studies').glob('*.json')):
        if path.name.endswith('.evidence.json'):
            continue
        lesson = json.loads(path.read_text())
        evidence = json.loads(path.with_name(path.stem + '.evidence.json').read_text())
        for branch in lesson['branches']:
            checked = evidence['branch:' + branch['id']]
            if checked['fen'] != branch['end_fen'] or saved_outcome(checked) != branch['outcome']:
                raise ValueError(f'Outcome evidence mismatch: {path.name} / {branch["id"]}')
        curated[lesson['video_id']] = lesson
    for lesson in curated.values():
        normalize_source_corrections(lesson)
    (DATA / 'studies.json').write_text(json.dumps(curated, ensure_ascii=False, indent=2) + '\n')
    reviews = load_reviews(sorted((PROJECT / 'scripts/story-batches').glob('*.json')), curated)
    catalog = []
    tasks = []
    manifests = hashlib.sha256()
    for order, entry in enumerate(entries):
        vid = entry['id']
        directory = extraction / vid
        meta = json.loads((directory / 'meta.json').read_text())
        manifest_path = directory / 'manifest.tsv'
        manifests.update(manifest_path.read_bytes())
        with manifest_path.open() as file:
            rows = list(csv.DictReader(file, delimiter='\t', quoting=csv.QUOTE_NONE))
        captions = json.loads((directory / 'captions.json').read_text())
        transcript = merge(c['text'] for c in captions)
        full_title = clean(entry['title'])
        title = re.sub(r'\s*#[\w]+', '', full_title).strip() or full_title
        tags = [name for name, pattern in THEMES.items() if re.search(pattern, transcript + ' ' + title, re.I)]
        # This is a source-discovery filter, not a claim about verified material.
        endgame = bool(vid in curated or re.search(r'end.?game|pawn|promot|opposition|zugzwang|stalemate|(?:rook|bishop|knight|queen)\s*(?:vs|versus)', full_title, re.I) or re.search(r'end.?game', transcript, re.I) or (len(tags) >= 3 and re.search(r'promot|stalemate|zugzwang', transcript, re.I)))
        excluded = bool(meta.get('excluded')) or vid == 'Z7SQg2fLB70'
        frames = []
        if not excluded:
            for row in rows:
                if row['decision'] != 'accepted':
                    continue
                if not .9 < int(row['crop_w']) / int(row['crop_h']) < 1.1:
                    continue
                filename = Path(row['image_file']).stem + '.webp'
                target = OUT / vid / filename
                tasks.append((directory / row['image_file'], target))
                frames.append(dict(time=float(row['timestamp_s']), end=float(row['span_end_s']), image=f'/endgame-stories/{vid}/{filename}', text=clean(row['caption_text']), overlay='obscured' in row['warnings']))
        item = dict(id=vid, title=title, originalTitle=full_title, order=order, endgame=endgame, verified=vid in curated, themes=tags, thumbnail=frames[0]['image'] if frames else None, frames=len(frames), hasNarration=bool(transcript), duration=meta['duration_s'], sourceUrl=f'https://www.youtube.com/watch?v={vid}')
        gaps = []
        if not frames:
            gaps.append('no usable saved board images')
        if not transcript:
            gaps.append('no saved captions')
        required = []
        if 'no usable saved board images' in gaps:
            required.append('Full-board images or a source video with readable pieces and square coordinates are needed to reconstruct the moves.')
        if 'no saved captions' in gaps:
            required.append('Captions or a transcription of the audio are needed to preserve the creator’s explanation; images alone may still allow chess reconstruction.')
        review = reviews.get(vid, {})
        if vid in curated and review.get('result') != 'verified_selected_lines':
            raise ValueError(f'Checked study needs a matching verified review: {vid}')
        status = 'verified_selected_lines' if vid in curated else review.get('result') or ('needs_information' if endgame and gaps else 'awaiting_reconstruction' if endgame else 'not_queued')
        required = review.get('information_needed', required) if status == 'needs_information' else []
        item.update(reviewStatus=status, sourceGaps=gaps, informationNeeded=required, reviewBatch=review.get('batch_id'), reviewNotes=review.get('notes', ''))
        catalog.append(item)
        payload = dict(**item, transcript=transcript, captions=[dict(start=c['start'], end=c['end'], text=clean(c['text'])) for c in captions], states=frames, excludedImages=excluded)
        (OUT / (vid + '.json')).write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    queue = []
    for item in catalog:
        if not item['endgame']:
            continue
        review = reviews.get(item['id'], {})
        queue.append(dict(video_id=item['id'], title=item['title'], status=item['reviewStatus'], source_gaps=item['sourceGaps'], information_needed=item['informationNeeded'], batch_id=review.get('batch_id'), reviewed_on=review.get('reviewed_on'), notes=review.get('notes', ''), analysis_required=review.get('analysis_required'), review_history=review.get('history', []), source_url=item['sourceUrl']))
    (DATA / 'review-queue.json').write_text(json.dumps(queue, ensure_ascii=False, indent=2) + '\n')
    counts = {status: sum(row['status'] == status for row in queue) for status in ['verified_selected_lines', 'awaiting_reconstruction', 'needs_information', 'not_applicable']}
    progress = dict(total_candidates=len(queue), counts=counts, batches=[json.loads(path.read_text())['batch_id'] for path in sorted((PROJECT / 'scripts/story-batches').glob('*.json'))])
    (DATA / 'progress.json').write_text(json.dumps(progress, indent=2) + '\n')
    (DATA / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Catalog: {len(catalog)} source videos, {sum(c["endgame"] for c in catalog)} endgame-related, {len(curated)} verified studies; encoding {len(tasks)} source snapshots.', flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for _ in pool.map(image_task, tasks):
            pass
    report = dict(source='Pietro Checkmate Shorts local board_v3 extraction', catalogVideos=len(catalog), endgameRelated=sum(c['endgame'] for c in catalog), verifiedStudies=len(curated), narratedVideos=sum(c['hasNarration'] for c in catalog), snapshots=len(tasks), excludedImageVideos=[c['id'] for c in catalog if c['id']=='Z7SQg2fLB70'], classification='Title and narration keyword discovery; the full channel remains searchable so candidates are not silently omitted.', manifestSha256=manifests.hexdigest(), license='Third-party source material retains its original ownership; project MIT license does not cover imported narration and video imagery.')
    (DATA / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
