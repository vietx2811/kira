import re

with open('styles.css', 'r') as f:
    css = f.read()

# Replace all these specific subtle linear gradients with transparent or flat backgrounds
css = re.sub(
    r'linear-gradient\(180deg,\s*color-mix\(in srgb, var\(--accent-cyan\), transparent 88%\),\s*transparent\)',
    r'color-mix(in srgb, var(--accent-cyan), transparent 90%)',
    css
)
css = re.sub(
    r'linear-gradient\(90deg,\s*rgb\(255 255 255 \/ 0\.07\),\s*rgb\(255 255 255 \/ 0\)\)',
    r'transparent',
    css
)
css = re.sub(
    r'linear-gradient\(180deg,\s*rgb\(255 255 255 \/ 0\.035\),\s*rgb\(255 255 255 \/ 0\.01\)\)',
    r'rgb(255 255 255 / 0.02)',
    css
)
css = re.sub(
    r'linear-gradient\(180deg,\s*color-mix\(in srgb, var\(--text-main\), transparent 96%\),\s*transparent\)',
    r'transparent',
    css
)
css = re.sub(
    r'linear-gradient\(180deg,\s*color-mix\(in srgb, var\(--text-main\), transparent 94%\),\s*transparent\)',
    r'transparent',
    css
)
css = re.sub(
    r'linear-gradient\(180deg,\s*color-mix\(in srgb, var\(--text-main\), transparent 90%\),\s*transparent\)',
    r'transparent',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
