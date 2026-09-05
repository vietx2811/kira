import re

with open('styles.css', 'r') as f:
    css = f.read()

# 1. Remove backdrop-filters
css = re.sub(r'^[ \t]*-webkit-backdrop-filter:.*?;[ \t]*\n', '', css, flags=re.MULTILINE)
css = re.sub(r'^[ \t]*backdrop-filter:.*?;[ \t]*\n', '', css, flags=re.MULTILINE)

# 2. Border-radius
css = re.sub(r'border-radius:\s*999px', r'border-radius: var(--radius-2)', css)
css = re.sub(r'border-radius:\s*(1[2-9]|[2-9][0-9])px', r'border-radius: var(--radius-3)', css)
css = re.sub(r'border-radius:\s*[7-9]px', r'border-radius: var(--radius-2)', css)

# 3. Gradients and colors
css = re.sub(r'var\(--kira-sweep\)', 'var(--accent-strong)', css)
css = re.sub(r'var\(--kira-sweep-soft\)', 'var(--accent-weak)', css)
css = re.sub(r'var\(--kira-tint\)', 'var(--accent-faint)', css)
css = re.sub(r'var\(--kira-halo\)', 'transparent', css)

# Let's remove the variables themselves from the :root just to be clean
# Actually, it's safer to keep them but redefine them as simple colors just in case some inline style uses it
css = re.sub(r'--kira-sweep:\s*linear-gradient[^;]+;', '--kira-sweep: var(--accent-strong);', css)
css = re.sub(r'--kira-sweep-soft:\s*linear-gradient[^;]+;', '--kira-sweep-soft: var(--accent-weak);', css)
css = re.sub(r'--kira-tint:\s*color-mix[^;]+;', '--kira-tint: var(--accent-faint);', css)
css = re.sub(r'--kira-halo:\s*color-mix[^;]+;', '--kira-halo: transparent;', css)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
