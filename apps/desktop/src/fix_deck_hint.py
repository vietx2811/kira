import re

with open('main.tsx', 'r') as f:
    tsx = f.read()

# Fix inline .deck-hint
tsx = re.sub(
    r'backdrop-filter:\s*blur\(8px\);?',
    r'',
    tsx
)
tsx = re.sub(
    r'\.deck-hint {([^}]*?)border-radius:\s*999px;',
    r'.deck-hint {\1border-radius: 6px;',
    tsx
)

with open('main.tsx', 'w') as f:
    f.write(tsx)

print("Done")
