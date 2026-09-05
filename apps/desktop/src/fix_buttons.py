import re

with open('styles.css', 'r') as f:
    css = f.read()

# Remove translateY(-1px)
css = re.sub(r'[ \t]*transform:\s*translateY\(-1px\);\n?', '', css)
css = re.sub(r'[ \t]*transform:\s*translateY\(-2px\);\n?', '', css)

# Make primary-button solid
css = re.sub(
    r'(\.primary-button\s*{[^}]*?)background:\s*var\(--glass-active\);',
    r'\1background: var(--accent-cyan);',
    css
)
css = re.sub(
    r'(\.primary-button\s*{[^}]*?)color:\s*var\(--accent-strong\);',
    r'\1color: var(--bg-base); font-weight: 500;',
    css
)
# primary-button hover
css = re.sub(
    r'(\.primary-button:hover\s*{[^}]*?)background:[^;]+;',
    r'\1background: var(--accent-strong);',
    css
)
css = re.sub(
    r'(\.primary-button:hover\s*{[^}]*?)color:[^;]+;',
    r'\1color: var(--bg-base);',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
