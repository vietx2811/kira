import re

with open('styles.css', 'r') as f:
    css = f.read()

css = re.sub(
    r'(\.idea-node--sticker\s*{[^}]*?)border-radius:\s*3px 12px 12px 12px;',
    r'\1border-radius: 0; /* Stickers are square in FigJam/Miro */',
    css
)

css = re.sub(
    r'(\.idea-node--sticker\s*{[^}]*?)background:\s*linear-gradient[^;]+;',
    r'\1background: color-mix(in srgb, var(--accent-amber), var(--bg-canvas) 72%);',
    css
)

css = re.sub(
    r'(\.idea-node--sticker\s*{[^}]*?)box-shadow:\s*0 10px 24px rgb\(0 0 0 \/ 0\.16\);',
    r'\1box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px var(--border-soft);',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
