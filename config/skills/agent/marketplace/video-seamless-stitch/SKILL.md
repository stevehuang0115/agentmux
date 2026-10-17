---
name: video-seamless-stitch
description: "Join generated video clips so the seams are invisible. Picks, by pixel comparison, the last frame of clip A and the first frame of clip B that are the same picture and move at the same speed, trims both there, hard-cuts, and crossfades audio for 80 ms. Use instead of a plain ffmpeg concat for clips generated from first/last frames."
category: video
skillType: claude-skill
triggers:
  - stitch generated clips
  - seamless join clips
  - join Veo clips
  - concat without jump
assignableRoles:
  - "*"
version: "1.0.0"
tags:
  - video
  - ffmpeg
  - stitch
  - generated-video
---

# Seamless stitch

Problem: with first/last-frame generation a clip does not end exactly on its end image, while the next clip starts exactly on it. A plain concat therefore jumps (typical measurement: frame-to-frame change of 11 to 16 at each seam against about 4 elsewhere), and the end of a clip often slows or settles.

```bash
python3 <video-clip-judge skill folder>/clipkit.py seams --clips c1.mp4 c2.mp4 c3.mp4 --out film.mp4 --report seams.json [--window 36]
```

Needs ffmpeg, python3 and numpy. Re-encode the clips to the same size, fps and audio first, for example 1280x720, 24 fps, 48 kHz AAC, normalising loudness to about -20 LUFS in the same ffmpeg call (Veo clips are quiet).

## How it chooses

For every seam it compares each of the last `window` frames of A with each of the first `window` frames of B (192x108 grayscale, mean absolute pixel difference) and adds a speed-continuity term, a motion-direction term and a small penalty for frames thrown away. B's matched frame is dropped (it equals A's) and playback continues from the next one. Video is concatenated by frame with no fades; audio gets an 80 ms triangular crossfade.

Typical result: seam pixel gap 11 to 16 before, 4 to 6 after; no frame-to-frame spike above 8.6 in the whole film; each seam trims about 7 frames of A's tail.

## Check after stitching (required)

1. In the report, `pix` should be well under `baseline_pix`. If `pix` stays above about 8, the clips are not the same picture there: regenerate or add a cutaway, do not blend.
2. Run `video-clip-judge` on each INPUT clip first. Stitching does not fix ghosting inside a clip.
3. Compare the largest frame-to-frame change of the output with the typical value, and look at each seam as an 8 fps tile sheet.
4. Known limit: a hard cut at the best-matching frame removes the jump but cannot fix a change of look between clips (clothing colour) or a wrong action.
