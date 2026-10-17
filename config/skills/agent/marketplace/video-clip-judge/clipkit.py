#!/usr/bin/env python3
"""clipkit: judge generated clips, and stitch clips at pixel-matched frames.

  clipkit.py judge  --clip A.mp4 [--start img] [--end img] --out DIR
  clipkit.py seams  --clips A.mp4 B.mp4 C.mp4 ... --out OUT.mp4 [--window 36] [--report r.json]
Needs: ffmpeg, python3 + numpy. No other deps.
"""
import argparse, json, subprocess, sys, os
import numpy as np

W, H = 192, 108

def run(cmd):
    return subprocess.run(cmd, capture_output=True)

def probe(path):
    r = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,nb_frames,duration', '-of', 'json', path])
    s = json.loads(r.stdout)['streams'][0]
    n, d = s['r_frame_rate'].split('/')
    return float(n) / float(d)

def frames(path, w=W, h=H, gray=False):
    pix = 'gray' if gray else 'rgb24'
    r = run(['ffmpeg', '-v', 'error', '-i', path, '-an', '-vf', f'scale={w}:{h}:flags=area', '-f', 'rawvideo', '-pix_fmt', pix, '-'])
    c = 1 if gray else 3
    a = np.frombuffer(r.stdout, np.uint8)
    n = a.size // (w * h * c)
    return a[: n * w * h * c].reshape(n, h, w, c).astype(np.float32) if not gray else a[: n * w * h].reshape(n, h, w).astype(np.float32)

def img_arr(path, w=W, h=H):
    r = run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=area', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(r.stdout, np.uint8).reshape(h, w, 3).astype(np.float32)

def mad(a, b):  # mean abs diff per pixel, 0..255
    return float(np.mean(np.abs(a - b)))

def audio_stats(path):
    r = run(['ffmpeg', '-i', path, '-vn', '-af', 'ebur128=peak=true,silencedetect=n=-45dB:d=0.4', '-f', 'null', '-'])
    t = r.stderr.decode(errors='ignore')
    out = {'integrated_lufs': None, 'true_peak_dbfs': None, 'silences': []}
    for line in t.splitlines():
        line = line.strip()
        if line.startswith('I:') and 'LUFS' in line: out['integrated_lufs'] = float(line.split()[1])
        if line.startswith('Peak:') and 'dBFS' in line: out['true_peak_dbfs'] = float(line.split()[1])
        if 'silence_start' in line: out['silences'].append({'start': float(line.split('silence_start:')[1])})
        if 'silence_duration' in line and out['silences']: out['silences'][-1]['dur'] = float(line.split('silence_duration:')[1].split()[0])
    return out

def sheet(path, out, n=12, cols=6):
    dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).stdout)
    fps = n / dur
    run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-an', '-vf', f'fps={fps},scale=384:-1,tile={cols}x{(n + cols - 1) // cols}', '-frames:v', '1', out])

def judge(a):
    os.makedirs(a.out, exist_ok=True)
    fps = probe(a.clip)
    g = frames(a.clip, gray=True)
    c = frames(a.clip, 96, 54)
    n = len(g)
    d = np.array([mad(g[i], g[i - 1]) for i in range(1, n)])  # d[i-1] = change into frame i
    med = float(np.median(d)); mdev = float(np.median(np.abs(d - med))) + 1e-6
    rep = {'clip': a.clip, 'fps': fps, 'frames': n, 'seconds': round(n / fps, 2), 'flags': [], 'checks': {}}
    # 1) spikes = jump cuts / sudden pushes / glitches; 2) freezes
    for i, v in enumerate(d):
        z = (v - med) / (1.4826 * mdev)
        if z > 6 and v > med * 2.2 + 1: rep['flags'].append({'type': 'jump', 't': round((i + 1) / fps, 2), 'diff': round(float(v), 2), 'typical': round(med, 2)})
    run_len = 0
    for i, v in enumerate(d):
        if v < 0.15: run_len += 1
        else:
            if run_len >= int(0.25 * fps): rep['flags'].append({'type': 'freeze', 't': round((i - run_len + 1) / fps, 2), 'frames': run_len})
            run_len = 0
    if run_len >= int(0.25 * fps): rep['flags'].append({'type': 'freeze', 't': round((n - run_len) / fps, 2), 'frames': run_len})
    # 3) dissolve / ghosting: a frame that is a blend of two far-apart frames is closer to their average than
    #    to either neighbour is to the other; test frame i against mean(frame i-k, i+k) (k=0.4 s) vs frame i-k/i+k
    k = max(2, int(0.4 * fps)); ghost = []
    for i in range(k, n - k):
        a_, b_, m_ = g[i - k], g[i + k], g[i]
        far = mad(a_, b_)
        if far < 12: continue
        to_blend = mad(m_, (a_ + b_) / 2)
        if to_blend < 0.45 * far and mad(m_, a_) > 0.5 * far * 0.6 and mad(m_, b_) > 0.5 * far * 0.6:
            ghost.append(i)
    # merge consecutive ghost frames into spans
    spans = []
    for i in ghost:
        if spans and i - spans[-1][1] <= 1: spans[-1][1] = i
        else: spans.append([i, i])
    for s, e in spans:
        if e - s >= 2: rep['flags'].append({'type': 'possible_dissolve', 't': round(s / fps, 2), 'to': round(e / fps, 2), 'note': 'frame sits between two different pictures; look at the sheet'})
    # 4) start / end frames match the given keyframes
    if a.start:
        e0 = mad(c[0], img_arr(a.start, 96, 54)); rep['checks']['start_frame_vs_keyframe'] = round(e0, 2)
        if e0 > 12: rep['flags'].append({'type': 'start_frame_off', 'diff': round(e0, 2)})
    if a.end:
        e1 = mad(c[-1], img_arr(a.end, 96, 54)); rep['checks']['end_frame_vs_keyframe'] = round(e1, 2)
        if e1 > 18: rep['flags'].append({'type': 'end_frame_off', 'diff': round(e1, 2), 'note': 'Veo does not hit the end image exactly; >18 means the clip ends in another scene'})
    # 5) look drift (centre region mean colour, first vs last second)
    cen = lambda f: f[:, 14:40, 30:66].mean(axis=(0, 1, 2))
    f0, f1 = cen(c[: int(fps)]), cen(c[-int(fps):])
    rep['checks']['centre_colour_first_vs_last_s'] = {'first': [round(x) for x in f0], 'last': [round(x) for x in f1], 'delta': round(float(np.abs(f0 - f1).mean()), 1)}
    rep['checks']['speed'] = {'median_change': round(med, 2), 'first_s': round(float(d[: int(fps)].mean()), 2), 'last_s': round(float(d[-int(fps):].mean()), 2)}
    rep['audio'] = audio_stats(a.clip)
    if rep['audio']['silences']: rep['flags'].append({'type': 'silence', 'spans': rep['audio']['silences']})
    if rep['audio']['true_peak_dbfs'] is not None and rep['audio']['true_peak_dbfs'] > -0.5: rep['flags'].append({'type': 'clipping', 'peak': rep['audio']['true_peak_dbfs']})
    sheet(a.clip, os.path.join(a.out, 'sheet.jpg'))
    # first/last 1.5 s at full rate for the eye
    run(['ffmpeg', '-v', 'error', '-y', '-t', '1.5', '-i', a.clip, '-an', '-vf', 'fps=8,scale=320:-1,tile=6x2', '-frames:v', '1', os.path.join(a.out, 'first.jpg')])
    run(['ffmpeg', '-v', 'error', '-y', '-sseof', '-1.5', '-i', a.clip, '-an', '-vf', 'fps=8,scale=320:-1,tile=6x2', '-frames:v', '1', os.path.join(a.out, 'last.jpg')])
    rep['verdict'] = 'REVIEW' if rep['flags'] else 'PASS_AUTOMATIC (still look at sheet.jpg against the prompt)'
    json.dump(rep, open(os.path.join(a.out, 'report.json'), 'w'), indent=1, ensure_ascii=False)
    print(json.dumps(rep, indent=1, ensure_ascii=False))

def pick_seam(A, B, fps, win):
    """A, B: gray frame arrays. choose (i, j): last shown frame of A and first shown frame of B (j is the frame after the match)."""
    na, nb = len(A), len(B)
    iA = range(max(2, na - win), na)
    jB = range(0, min(win, nb - 2))
    spd = lambda X, i: mad(X[i], X[i - 1])
    best = None
    for i in iA:
        sa = spd(A, i)
        va = A[i] - A[i - 1]
        for j in jB:
            # B[j] should be the same picture as A[i]; show B[j+1] next
            pix = mad(A[i], B[j])
            sb = mad(B[j + 1], B[j])
            dyn = abs(sa - sb)                           # speed continuity
            vb = B[j + 1] - B[j]
            dirc = float(np.mean(np.abs(va - vb)))        # direction/velocity continuity (same sign pattern)
            trim = (na - 1 - i) + j                       # frames thrown away: small is better
            cost = pix + 0.8 * dyn + 0.35 * dirc + 0.04 * trim
            if best is None or cost < best['cost']:
                best = {'i': i, 'j': j, 'cost': round(cost, 3), 'pix': round(pix, 3), 'speed_gap': round(dyn, 3), 'vel_gap': round(dirc, 3), 'trim_frames': trim}
    return best

def seams(a):
    fps = probe(a.clips[0])
    G = [frames(p, gray=True) for p in a.clips]
    cuts = []
    for k in range(len(G) - 1):
        # baseline = plain concat (last frame of A, first frame of B)
        base_pix = mad(G[k][-1], G[k + 1][0])
        base_speed_gap = abs(mad(G[k][-1], G[k][-2]) - mad(G[k + 1][1], G[k + 1][0]))
        s = pick_seam(G[k], G[k + 1], fps, a.window)
        s['baseline_pix'] = round(base_pix, 3); s['baseline_speed_gap'] = round(base_speed_gap, 3)
        cuts.append(s)
    # per-clip keep ranges [first, last] inclusive (frame indexes)
    keep = []
    for k, G_ in enumerate(G):
        first = cuts[k - 1]['j'] + 1 if k > 0 else 0
        last = cuts[k]['i'] if k < len(G) - 1 else len(G_) - 1
        keep.append([first, last])
    # build: trim each clip by frame, 80 ms audio crossfades
    inp, vf, af = [], [], []
    for k, p in enumerate(a.clips):
        f0, f1 = keep[k]
        t0, t1 = f0 / fps, (f1 + 1) / fps
        inp += ['-i', p]
        vf.append(f"[{k}:v]trim=start_frame={f0}:end_frame={f1 + 1},setpts=PTS-STARTPTS,fps={fps}[v{k}]")
        af.append(f"[{k}:a]atrim=start={t0:.4f}:end={t1:.4f},asetpts=PTS-STARTPTS,aresample=48000[a{k}]")
    n = len(a.clips)
    chain = ''.join(f"[v{k}]" for k in range(n)) + f"concat=n={n}:v=1:a=0[vout]"
    prev = 'a0'; fa = []
    for k in range(1, n):
        fa.append(f"[{prev}][a{k}]acrossfade=d=0.08:c1=tri:c2=tri[ax{k}]"); prev = f"ax{k}"
    fc = ';'.join(vf + af + [chain] + fa)
    cmd = ['ffmpeg', '-v', 'error', '-y'] + inp + ['-filter_complex', fc, '-map', '[vout]', '-map', f'[{prev}]', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', a.out]
    r = run(cmd)
    if r.returncode: print(r.stderr.decode()[-800:]); sys.exit(1)
    rep = {'fps': fps, 'seams': cuts, 'keep_frames': keep, 'out': a.out}
    if a.report: json.dump(rep, open(a.report, 'w'), indent=1)
    print(json.dumps(rep, indent=1))

if __name__ == '__main__':
    p = argparse.ArgumentParser(); sub = p.add_subparsers(dest='cmd', required=True)
    j = sub.add_parser('judge'); j.add_argument('--clip', required=True); j.add_argument('--start'); j.add_argument('--end'); j.add_argument('--out', required=True)
    s = sub.add_parser('seams'); s.add_argument('--clips', nargs='+', required=True); s.add_argument('--out', required=True); s.add_argument('--window', type=int, default=36); s.add_argument('--report')
    a = p.parse_args()
    judge(a) if a.cmd == 'judge' else seams(a)
