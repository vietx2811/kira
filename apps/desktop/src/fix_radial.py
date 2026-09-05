import re

with open('styles.css', 'r') as f:
    css = f.read()

# Remove the blobs for onboarding overlay
css = re.sub(
    r'background:\s*radial-gradient\(circle at 22% 18%[^;]+;',
    r'background: var(--bg-canvas);',
    css
)

# Remove the blobs for settings-shell
css = re.sub(
    r'background:\s*radial-gradient\(circle at 24% 0%[^;]+;',
    r'background: var(--surface-1);',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
