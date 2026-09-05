import re

with open('styles.css', 'r') as f:
    css = f.read()

# Replace glass variables with solid equivalents from the palette
css = re.sub(r'--glass-chrome:\s*rgb[^;]+;', '--glass-chrome: var(--surface-2);', css)
css = re.sub(r'--glass-content:\s*rgb[^;]+;', '--glass-content: var(--surface-1);', css)
css = re.sub(r'--material-drawer:\s*rgb[^;]+;', '--material-drawer: var(--surface-drawer);', css)
css = re.sub(r'--material-inspector:\s*rgb[^;]+;', '--material-inspector: var(--surface-inspector);', css)
css = re.sub(r'--material-window-chrome:\s*transparent;', '--material-window-chrome: var(--bg-base);', css)
# Ensure --glass-sidebar, etc. point to solid
css = re.sub(r'--glass-sidebar:\s*var\(--material-window-chrome\);', '--glass-sidebar: var(--bg-base);', css)

# Make node surfaces more solid
css = re.sub(r'--node-surface:\s*rgb[^;]+;', '--node-surface: var(--surface-1);', css)
css = re.sub(r'--node-surface-selected:\s*rgb[^;]+;', '--node-surface-selected: var(--surface-2);', css)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
