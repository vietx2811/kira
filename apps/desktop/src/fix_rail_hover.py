import re

with open('styles.css', 'r') as f:
    css = f.read()

# Remove hover box-shadow for buttons in tool rail
css = re.sub(
    r'(\.canvas-tool-rail button:hover,\s*\n\.canvas-tool-rail button:focus-visible\s*{[^}]*?)box-shadow:\s*0 4px 10px rgb[^;]+;',
    r'\1',
    css
)

# Remove tool icon drop shadow
css = re.sub(
    r'\.canvas-tool-rail button\[data-tool-kind\]:hover \.tool-icon,\s*\n\.canvas-tool-rail button\[data-tool-kind\]:focus-visible \.tool-icon\s*{[^}]*?}',
    r'',
    css
)

with open('styles.css', 'w') as f:
    f.write(css)

print("Done")
