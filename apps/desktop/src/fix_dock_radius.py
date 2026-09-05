import re

with open('styles.css', 'r') as f:
    css = f.read()

css = re.sub(
    r'(\.kira-dock\.is-open\s*{[^}]*?)border-radius:\s*var\(--radius-5\);',
    r'\1border-radius: var(--radius-3);',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
