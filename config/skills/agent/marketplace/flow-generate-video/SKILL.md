---
name: flow-generate-video
description: "Make a short film from AI-generated clips in Google Flow (Veo) through Crewly in Chrome. Keyframe images first, then one clip per pair of neighbouring keyframes, a judge step per clip with re-draws, and a pixel-matched stitch. Use when asked to generate video with Veo/Flow. Costs credits: agree the budget with the user first."
category: video
skillType: claude-skill
triggers:
  - generate video with Veo
  - make a video in Flow
  - AI video clips
  - keyframe video
assignableRoles:
  - "*"
version: "1.0.0"
tags:
  - video
  - veo
  - flow
  - browser
---

# Flow to Veo: keyframes, clips, judge, stitch

Order of work: keyframes -> clips -> judge each clip -> re-draw rejects -> stitch -> check seams.
Related skills: `video-clip-judge` (the gate after every clip), `video-seamless-stitch` (the join), `remote-browser` (drives Chrome; see also its `SOP-google-flow-video.md` for upload and file-input gotchas).

Needs Crewly in Chrome to be drivable and signed in to a Google account whose Flow plan includes Veo. Use that account's own Flow URL (`https://flow.google.com/u/<n>/`, where `<n>` is the browser's account index); a different signed-in account may have no Veo access or a smaller credit pool. All commands: `CREWLY_SESSION_NAME=<me> bash config/skills/agent/remote-browser/execute.sh -a <action> ...`. Never click "Always approve": spending stays confirmed.

## Budget rules

- Image generation is free; video costs credits (about 10 for one 8 s Veo 3.1 Fast clip at x1; x2 doubles it). Prices change, so read the number Flow shows.
- Agree a credit cap before the first clip. Stop and ask when a re-draw would exceed it, or when a clip still fails after 2 re-draws.
- Count draws, not clips: a clip that needed 3 draws cost 3 clips.

## Method: keyframe-pair chain

1. **Plan the story as N+1 keyframe images** for N clips. Same camera angle, distance, framing and light in every image; adjacent images differ only by about 8 s of action. Prefer one place, one subject, stable light: the further apart two keyframes are, the more the model cross-dissolves between them.
2. **Make the keyframes (free).** Make frame 1 from text. Make every next frame with the previous frame attached as a reference (the "+" in the prompt bar, pick by exact title, "Add to prompt") and text such as "same person, same place, same camera position, same framing, same light as the reference; only the action changes". Look at them yourself and regenerate any that drift.
3. **Put every prop the action needs into the start keyframe.** A held object that is absent from the start frame is the weak point: the model makes it appear or smear for about 0.25 s.
4. **Clip N = Start image N + End image N+1**, 8 s, x1. Every clip's end is the next clip's start, so seams are real matches.
5. **Write each prompt as a transition**, not a mood:
   - the start action and the pose at the start;
   - the path in between, in order ("turns left, walks two steps to the machine, stops, looks down");
   - the end pose, matching the end image;
   - invariants: same person, clothing, light and background; exactly one of each key object, it never moves; no new objects appear; the person never leaves frame or turns away;
   - the camera: fixed, or only a very slow gentle drift. No push-in, zoom, cut, dissolve, new location or time of day inside a clip;
   - name positions on screen ("the machine on the left of the frame");
   - sound: natural ambient only, "No music, no dialogue, no text".
   If the story needs a different shot size (a close-up), make it a separate step whose start keyframe is already that size, and accept a real cut between the two.
6. **Generate.** Clips can be queued back to back; they generate in parallel (about 2.5 min for four). New items land newest-first in the grid, so the top-left tile is the last one submitted.
7. **Download** each at 720p, then re-encode every clip to the same 1280x720 / 24 fps / 48 kHz AAC with `loudnorm` I=-20 in the same ffmpeg call (downloads are quiet, about -30 to -38 LUFS; do not use `loudnorm` with `-c:v copy`).
8. **Judge** every clip with `video-clip-judge`. Reject and re-draw (with a revised prompt that names what went wrong) until it passes or the cap/retry limit is reached.
9. **Stitch** with `video-seamless-stitch`, never a plain concat. Frame-step each seam as an 8 fps tile sheet.
10. **Report honestly:** draws per clip, what was rejected and why, credits used, remaining flaws, and whether anyone listened to the sound (loudness measured is not the same as listened).

## Browser mechanics (Flow UI, verified Oct 2026; selectors can change)

- Project page has a direct prompt bar: type in `.ProseMirror`, then click `[aria-label="Start generation"]`.
- The settings pill (`button[aria-label="Settings trigger"]`) chooses Image or Video; for video choose Frames, 16:9, 8 s, x1, Veo 3.1 Fast.
- Frame slots are `button.empty-chip` (text Start / End). Clicking one opens "Select a frame image": type the title into `.cdk-overlay-pane input.search-input`, then click the `.cdk-overlay-pane .asset-title` whose text equals the title EXACTLY, then `.cdk-overlay-pane .bottom-actions button` ("Add to prompt"). Filtering by search text alone is not enough: taking the first match once put the same image in both slots and wasted a draw.
- **Before pressing Start generation, verify** `flow-ingredient-bar img` shows the expected frames and that the Start and End image ids differ. With no frame set, a generation can run text-only.
- Uploading your own image: there is no file input; drop a `File` built from base64 onto `document.body` with a `DataTransfer` via `execute-js` (about 100 KB jpg works). Name files uniquely.
- Keyframe image URLs (`img[src*="flow-content.google/image/"]`) are signed and can be fetched with curl.
- Download: click a tile, then `[aria-label="Download media"]`, then the `flow-menu-item` containing 720p (1080p/4K are upscaled and paid; 270p is a GIF). The video element is not exposed in the DOM, so this is the only way to get the file. `arrow_back` returns to the grid.
- Coordinate clicks are unreliable (layout shifts); use selectors. Never click at the very top of the page (it opens a tile). The "+" in the prompt bar has no stable selector.
- The edit box on an open video may show "Veo 3.1 - Lite" whatever the default is; do not regenerate there, it costs credits.

## Gotchas learned

- Giving a start frame and an end frame whose pictures are far apart produces cross-dissolves, ghost double-images and jump cuts. Keep adjacent keyframes close, or add an intermediate keyframe.
- A prompt that asks for a reframing the start frame cannot reach (push-in, close-up) makes the model dissolve a second composition over the first for about 0.5 s.
- Without named invariants, a draw can walk the person away, turn their back to the camera, or add a second copy of a prop.
- Character drift over a chain (clothing colour changing) cannot be fixed by stitching; repeat the clothing description in every prompt and watch `centre_colour` in the judge report.
- When a clip glitches late, you can cut it earlier and still use it, if the next clip's start keyframe is what matters (keyframe-pair chain) and the seam tool finds a match.
