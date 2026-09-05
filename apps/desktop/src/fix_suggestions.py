import re

with open('styles.css', 'r') as f:
    css = f.read()

# Make suggestion chips look like normal buttons (neutral colors)
css = re.sub(
    r'(\.suggestion-row button,\s*\n*\.suggestion-chip\s*{[^}]*?)border:\s*1px solid rgb\(223 174 103 \/ 0\.2\);',
    r'\1border: 1px solid var(--border-soft);',
    css
)
css = re.sub(
    r'(\.suggestion-row button,\s*\n*\.suggestion-chip\s*{[^}]*?)background:\s*rgb\(223 174 103 \/ 0\.08\);',
    r'\1background: var(--surface-1);',
    css
)

css = re.sub(
    r'(\.suggestion-row button,\s*\n*\.suggestion-chip button\s*{[^}]*?)color:\s*#f3d3a1;',
    r'\1color: var(--text-soft);',
    css
)
css = re.sub(
    r'(\.suggestion-chip button \+ button\s*{[^}]*?)color:\s*rgb\(243 211 161 \/ 0\.58\);',
    r'\1color: var(--text-muted);',
    css
)
css = re.sub(
    r'(\.suggestion-chip small\s*{[^}]*?)color:\s*rgb\(243 211 161 \/ 0\.58\);',
    r'\1color: var(--text-muted);',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
