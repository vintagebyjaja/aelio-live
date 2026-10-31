# Approved source images and derived runtime assets

Source: owner-uploaded AUREVIA_Visual_References.zip, containing only the three PNGs below. These originals are preserved byte-for-byte and are review references, not playable geometry. The character concept guides interface composition and illustrative style thumbnails. The clean runtime map and empty character stage were image-generation edits of the source references; no third-party stock artwork or 3D meshes were supplied. Runtime WebP encoding preserves the resulting compositions.

- `AELIO_Agent_Creator.png` SHA-256 `40f9efaffaacbcf38ed41f03fd028c6e003e4bd11641ec4a548e71b1483bc18f`
- `AUREVIA_Campus_Map.png` SHA-256 `a7ba5bdb4713aaf87ab5fdd0fea4be220a0a697b554c004f81e143aa3bf8e4a2`
- `AUREVIA_Location_Previews.png` SHA-256 `d6b56f4bd8443fe1240f2bd4a6ac8217132321fa41b72f6c2e4238a86d2515f7`

Runtime provenance:

- `assets/aurevia-map/campus.webp`: cleaned map derived from AUREVIA_Campus_Map.png; navigation overlays are actual UI controls.
- `assets/character-creator/stage.webp`: empty room derived from AELIO_Agent_Creator.png, with reference person and UI removed; the editable body is actual runtime geometry.
- `assets/character-creator/style-guides.webp`: encoded supplied creator concept, CSS-cropped only into explicitly illustrated style-guide thumbnails.

No GLB/GLTF, rigged model, clothing mesh or animation assets were found in the supplied ZIP or existing repository. The new procedural model is functional but does not reproduce production-reference likeness. See the release implementation note for remaining asset work.
