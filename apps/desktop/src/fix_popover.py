import re

with open('styles.css', 'r') as f:
    css = f.read()

# Fix huge popover shadow
css = re.sub(
    r'box-shadow:\s*0 30px 80px rgb\(0 0 0 \/ 0\.45\);',
    r'box-shadow: 0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px var(--border-soft);',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
