# 3D Model Creation Workflow

This document describes how to create custom 3D character models for the AgentMux factory visualization.

## Overview

The workflow involves:
1. Generate a concept image using AI image generation
2. Convert the image to a 3D model using Hunyuan 3D
3. Add animations using Mixamo
4. Combine animations and optimize for web

---

## Step 1: Generate Concept Image

Use an AI image generation tool to create a character concept:

### Using Nano Banana (or similar)
1. Go to your preferred AI image generator
2. Create a prompt for your character, e.g.:
   - "cute cartoon cow character, full body, white background, 3D render style"
   - "stylized horse mascot, standing pose, clean background"
3. Generate multiple variations and pick the best one
4. Download the image (PNG recommended)

**Tips:**
- Use a clean/white background for better 3D conversion
- Full body shots work best
- Simple, stylized designs convert better than photorealistic ones

---

## Step 2: Convert to 3D with Hunyuan 3D

Hunyuan 3D is Tencent's image-to-3D model that creates GLB files from images.

### Using Hunyuan 3D
1. Go to [Hunyuan 3D](https://hunyuan3d.github.io/) or use the API
2. Upload your concept image
3. Wait for the 3D generation (usually 1-2 minutes)
4. Download the GLB file

### Output
- You'll get a GLB file with:
  - Mesh geometry
  - PBR textures (base color, normal, metallic-roughness)
  - Usually 4K textures (4096x4096)

**Save as:** `<character>-original.glb`

---

## Step 3: Optimize Textures (Optional but Recommended)

The original Hunyuan output may have 4K textures which can cause WebGL issues.

### Using Blender to Resize Textures

```bash
blender --background --python fix-cow-textures.py
```

The script (`fix-cow-textures.py`):
```python
#!/usr/bin/env python3
"""Resize textures to 1K for WebGL compatibility."""
import bpy
import os

def fix_textures():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "<character>-original.glb")
    output_path = os.path.join(script_dir, "<character>-fixed.glb")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=input_path)

    for image in bpy.data.images:
        if image.name == "Render Result":
            continue
        if image.size[0] > 1024 or image.size[1] > 1024:
            image.scale(1024, 1024)

    bpy.ops.file.pack_all()
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_draco_mesh_compression_enable=False,  # No Draco for compatibility
    )

if __name__ == "__main__":
    fix_textures()
```

**Output:** `<character>-fixed.glb` (smaller file, 1K textures)

---

## Step 4: Add Animations with Mixamo

Mixamo is Adobe's free service for auto-rigging and animating 3D characters.

### Convert GLB to FBX for Mixamo

Mixamo requires FBX format. Use Blender:

```bash
blender --background --python glb-to-fbx.py -- <character>.glb <character>.fbx
```

Or manually in Blender:
1. Import the GLB file
2. Export as FBX with these settings:
   - Path Mode: Copy
   - Embed Textures: Yes

### Upload to Mixamo
1. Go to [Mixamo](https://www.mixamo.com/)
2. Upload your FBX file
3. Wait for auto-rigging (adjust bone placements if needed)

### Download Animations
Download each animation you need:
- **Idle** - standing/breathing animation
- **Walking** - locomotion
- **Typing** - keyboard typing motion
- **Sitting** - seated pose
- **Dance** - fun animation for celebrations

**Settings for each download:**
- Format: FBX Binary
- Skin: With Skin (for the first/base animation only)
- Frames per Second: 30
- Keyframe Reduction: None

**Save as:**
- `<character>-idle.fbx` (with skin)
- `<character>-walking.fbx` (without skin)
- `<character>-typing.fbx` (without skin)
- etc.

---

## Step 5: Combine Animations into Single GLB

Use Blender to merge all animations into one file:

```bash
blender --background --python combine-animations.py -- \
  <character>-animated.glb \
  <character>-idle.fbx \
  <character>-walking.fbx \
  <character>-typing.fbx \
  <character>-sitting.fbx
```

The script (`combine-animations.py`):
```python
#!/usr/bin/env python3
"""Combine multiple Mixamo FBX animations into single GLB."""
import bpy
import sys
import os

def combine_animations(output_path, base_fbx, animation_fbxs):
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import base model with first animation
    bpy.ops.import_scene.fbx(filepath=base_fbx)
    armature = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')

    # Rename first animation
    if armature.animation_data and armature.animation_data.action:
        armature.animation_data.action.name = get_anim_name(base_fbx)

    actions = {armature.animation_data.action.name: armature.animation_data.action}

    # Import additional animations
    for anim_fbx in animation_fbxs:
        old_actions = set(bpy.data.actions)
        bpy.ops.import_scene.fbx(filepath=anim_fbx)

        new_action = (set(bpy.data.actions) - old_actions).pop()
        new_action.name = get_anim_name(anim_fbx)
        actions[new_action.name] = new_action

        # Remove duplicate objects
        for obj in list(bpy.data.objects):
            if obj != armature and obj.type in ('ARMATURE', 'MESH'):
                bpy.data.objects.remove(obj, do_unlink=True)

    # Create NLA tracks
    for name, action in actions.items():
        track = armature.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, int(action.frame_range[0]), action)

    # Export
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_animations=True,
        export_nla_strips=True,
    )

def get_anim_name(filepath):
    name = os.path.splitext(os.path.basename(filepath))[0]
    if '-' in name:
        name = name.split('-')[-1]
    return name.capitalize()

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:]
    combine_animations(argv[0], argv[1], argv[2:])
```

**Output:** `<character>-animated.glb` with all animations embedded

---

## Step 6: Integrate into AgentMux

### Add Model Path
In `src/types/factory.types.ts`:
```typescript
export const MODEL_PATHS = {
  ROBOT: '/models/RobotExpressive.glb',
  COW: '/models/cow/cow-fixed.glb',
  // Add your new model:
  HORSE: '/models/horse/horse-animated.glb',
} as const;
```

### Create Agent Component
Create a new component similar to `CowAgent.tsx`:
```typescript
// src/components/Factory3D/Agents/HorseAgent.tsx
import { useGLTF, useAnimations } from '@react-three/drei';

export const HorseAgent: React.FC<{ agent: FactoryAgent }> = ({ agent }) => {
  const { scene, animations } = useGLTF(MODEL_PATHS.HORSE);
  const { actions, mixer } = useAnimations(animations, scene);

  // ... animation and positioning logic
};
```

### Fix Materials if Needed
Hunyuan models often have high metalness. Fix in your component:
```typescript
clone.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    const mat = child.material as THREE.MeshStandardMaterial;
    if (mat.isMeshStandardMaterial) {
      mat.metalnessMap = null;
      mat.roughnessMap = null;
      mat.metalness = 0.0;
      mat.roughness = 0.7;
      mat.needsUpdate = true;
    }
  }
});
```

---

## File Structure

```
public/models/
├── README.md                    # This file
├── employees/                   # Animal agents (workstation workers)
│   ├── cow/
│   │   ├── cow-original.glb     # Raw Hunyuan output (34MB, 4K textures)
│   │   ├── cow-fixed.glb        # Optimized (4MB, 1K textures)
│   │   ├── cow-animated.glb     # Combined with animations
│   │   └── actions/             # Mixamo animation FBX files
│   ├── horse/
│   ├── tiger/
│   ├── rabbit/
│   └── robot/
│       └── RobotExpressive.glb  # Default robot model
├── guests/                      # NPC visitors
│   ├── stevejobs/
│   ├── sundarpichai/
│   ├── elonmusk/
│   ├── markzuckerberg/
│   ├── jensenhuang/
│   └── stevehuang/
├── objects/                     # Non-character items
│   └── cybertruck/
└── scripts/                     # Utility scripts
    ├── combine-animations.py    # Merge animations into single GLB
    ├── glb-to-fbx.py           # Convert GLB to FBX for Mixamo
    └── optimize-glb.sh         # Optimize model file size
```

---

## Troubleshooting

### Model appears black/dark
- Remove metalness/roughness texture maps
- Set `metalness: 0` and `roughness: 0.7`
- Ensure scene has adequate lighting (use day mode)

### Model doesn't load (Draco error)
- Re-export without Draco compression: `export_draco_mesh_compression_enable=False`
- Or add DRACOLoader to your Three.js setup

### Textures cause WebGL warnings
- "Trying to use 16 texture units" = too many/large textures
- Resize textures to 1024x1024 or smaller

### Animations don't play
- Check animation names match: `actions['Idle']`, `actions['Walking']`, etc.
- Ensure NLA tracks were exported properly
- Log available animations: `console.log(Object.keys(actions))`

### Model too small/large
- Compute bounding box and scale to target height
- Typical agent height: 1.5-2.5 units

---

## Requirements

- **Blender 3.0+** - For model processing and animation combining
- **Mixamo account** - Free Adobe account for animations
- **Hunyuan 3D access** - For image-to-3D conversion

---

## Credits

- Robot model: [RobotExpressive](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive)
- Auto-rigging: [Mixamo](https://www.mixamo.com/)
- Image-to-3D: [Hunyuan 3D](https://hunyuan3d.github.io/)
