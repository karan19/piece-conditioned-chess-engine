3D Chess Pieces Pack - low-poly LOD
Generated with polyy.ai

12 chess pieces in GLB format. Decimated LOD meshes with JPEG-compressed color maps.
A complete Staunton set: king, queen, bishop, knight, rook and pawn,
each in pale polished boxwood and in dark walnut, with a thin inlay
ring of the other wood at the base. Smooth turned profiles, no
engraving or gilding.

Contents
  models/    GLB meshes, one file per piece (<piece>_<light|dark>)
  previews/  animated turntable GIF for each piece, same filename
  LICENSE.txt

Engine notes
  Godot 4:   drag the .glb into the FileSystem dock and instance the scene.
  Unity:     GLB needs glTFast or UnityGLTF; both read these files directly.
  Unreal 5:  Import the .glb through the Content Browser.
  Blender:   File > Import > glTF 2.0.

Mesh details
  One mesh and one PBR material per file, with base color and
  metallic/roughness textures embedded (JPEG/PNG). No normal maps.
  Roughly 3,559 to 4,635 triangles per piece.
  Y-up, standing upright with the base at the bottom. The origin sits at
  the center of the bounding box and every piece is normalized to about
  1 unit tall, so scale each type in the engine. Tournament proportions
  relative to the king: queen 0.87, bishop 0.70, knight 0.67, rook 0.60,
  pawn 0.53; a king stands about 1.6 squares tall on a standard board.
  Knights face +Z (the mesh's front); the king's cross and the bishop's
  slit lie in the XZ-facing plane, so a 180 degree turn about Y faces
  the other side of the board.

File list
  01_king_light.glb
  02_king_dark.glb
  03_queen_light.glb
  04_queen_dark.glb
  05_bishop_light.glb
  06_bishop_dark.glb
  07_knight_light.glb
  08_knight_dark.glb
  09_rook_light.glb
  10_rook_dark.glb
  11_pawn_light.glb
  12_pawn_dark.glb
