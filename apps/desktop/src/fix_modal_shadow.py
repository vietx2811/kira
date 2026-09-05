import re

with open('styles.css', 'r') as f:
    css = f.read()

css = re.sub(
    r'box-shadow:\s*0 24px 70px rgb\(0 0 0 \/ 0\.2\);',
    r'box-shadow: 0 12px 36px rgba(0,0,0,0.25), 0 0 0 1px var(--border-soft);',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
