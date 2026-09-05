import re

with open('styles.css', 'r') as f:
    css = f.read()

css = re.sub(r'--node-shadow:\s*[^;]+;', '--node-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px var(--border-strong);', css)
css = re.sub(r'--node-shadow-rest:\s*[^;]+;', '--node-shadow-rest: 0 2px 6px rgba(0, 0, 0, 0.1), 0 0 0 1px var(--border-soft);', css)
css = re.sub(r'--node-shadow-hover:\s*[^;]+;', '--node-shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px var(--border-strong);', css)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
