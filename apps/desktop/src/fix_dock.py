import re

with open('styles.css', 'r') as f:
    css = f.read()

# Fix .kira-dock.is-open background and box-shadow
css = re.sub(
    r'(\.kira-dock\.is-open\s*{[^}]*?background:)[^;]+;',
    r'\1 var(--surface-inspector);',
    css
)
css = re.sub(
    r'(\.kira-dock\.is-open\s*{[^}]*?box-shadow:)[^;]+;',
    r'\1 0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px var(--border-strong);',
    css
)

# Fix .kira-dock background and box-shadow
css = re.sub(
    r'(\.kira-dock\s*{[^}]*?background:)[^;]+;',
    r'\1 var(--surface-inspector);',
    css
)
css = re.sub(
    r'(\.kira-dock\s*{[^}]*?box-shadow:)[^;]+;',
    r'\1 0 2px 6px rgba(0,0,0,0.1), 0 0 0 1px var(--border-soft);',
    css
)

# Remove .kira-dock::before hologram rim
css = re.sub(
    r'\.kira-dock::before\s*{[^}]*?}',
    r'.kira-dock::before { display: none; }',
    css
)

# Remove @property --kira-rim-angle
css = re.sub(
    r'@property --kira-rim-angle\s*{[^}]*?}',
    r'',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
