# Affinity Graph Preview

Standalone 3D preview for the demo affinity data.

Run from the repository root:

```bash
python3 -m http.server 4177 --bind 127.0.0.1 --directory preview/affinity-graph
```

Open:

```text
http://127.0.0.1:4177/
```

Controls:

- Drag to rotate the graph.
- Scroll or pinch to zoom.
- Click a member initials badge to show profile and strongest connections.
- Selecting a member keeps only that member and directly connected members visible.
- Move the minimum-link slider to hide weaker edges. In the full forest view, all members stay visible, including disconnected members.
