---
name: video-clip-judge
description: "Decide whether an AI-generated video clip (Veo, Flow and similar) is usable before it goes into a film. Runs automatic checks for ghost/dissolve, jump cuts, freezes, keyframe mismatch, look drift and audio, then a fixed visual checklist against the prompt. Use after every generated clip and before stitching. Generation is a lottery; this is the gate."
category: video
skillType: claude-skill
triggers:
  - judge generated clip
  - check AI video clip
  - Veo clip quality
  - ghost or dissolve in clip
assignableRoles:
  - "*"
version: "1.0.0"
tags:
  - video
  - qa
  - veo
  - generated-video
---

# Judge a generated clip

Tool: `clipkit.py` in this folder (ffmpeg + python3 + numpy only, no network).

```bash
python3 <video-clip-judge skill folder>/clipkit.py judge --clip clip.mp4 [--start start.jpg] [--end end.jpg] --out OUT_DIR
```

Writes `OUT_DIR/report.json`, `sheet.jpg` (12 frames across the clip) and `first.jpg` / `last.jpg` (the first and last 1.5 s at 8 fps). The verdict is `REVIEW` if anything is flagged, otherwise `PASS_AUTOMATIC`. `PASS_AUTOMATIC` is NOT a pass: step 2 below is always required.

## 1. Automatic flags

- `possible_dissolve` (t..to): a frame sits between two different pictures. In practice this catches real ghost double-images in the middle of a clip (a person and a boat doubled for about 0.6 s) that a look at the seams alone misses. Always open the span: `ffmpeg -ss T -t 1 -i clip.mp4 -vf fps=10,scale=320:-1,tile=8x1 -frames:v 1 x.jpg`. A background-only fade (fog changing) is mild; a doubled subject is a reject.
- `jump`: sudden change between neighbouring frames (cut, push-in, glitch). Often a real object glitch (a prop smearing in), so open the flagged span instead of assuming it is a cut.
- `freeze`: picture frozen for at least 0.25 s.
- `start_frame_off` (diff above 12) / `end_frame_off` (diff above 18): the clip does not begin or end on the keyframe. Veo reaches an end image only approximately (9 to 12 is normal; above 18 means it ended in another scene).
- `silence`, `clipping`: audio gaps (over 0.4 s below -45 dB) or a peak above -0.5 dBFS.
- `checks.centre_colour_first_vs_last_s.delta`: look drift (clothing or skin colour) between the first and last second. Above 15, look at it.

## 2. Visual checklist (every time, against the prompt that made the clip)

Look at `sheet.jpg`, `first.jpg`, `last.jpg` and every flagged span. Write one line per item:

1. Did the action in the prompt happen, in order?
2. Same subject all through? One person, same clothing colour, no second person, no doubling, no second copy of a prop.
3. Anatomy and objects: hands correct, no extra limbs, objects not melting or appearing from nowhere.
4. Camera: stays as prompted (no push-in, no cut to another framing).
5. Physics: things move the way the forces on them imply.
6. Frame edges: no text, watermark or UI.
7. Sound: matches what is on screen; no music or voice if the prompt said none. If nobody listened, say "not listened" instead of "sound OK".

## 3. Decision

- Doubled subject, extra limb, jump cut, wrong action: REJECT and regenerate. Say which flag and frame. Regenerating costs credits, so stay inside the budget the user gave and stop to ask when it would be exceeded.
- Mild background fade only: ACCEPT with a note, or regenerate if budget allows.
- Why clips ghost: the start and end keyframes are too far apart (a different place, a lighting change, a big camera change), so the model cross-dissolves between them. Fix it before spending: put the keyframes closer, or add an intermediate keyframe.
- Report the verdict with the flagged times. Never claim "no ghost" from a seam-only look.
