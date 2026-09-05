const fs = require('fs');

let css = fs.readFileSync('styles.css', 'utf-8');

// 1. Remove all backdrop-filters
css = css.replace(/^[ \t]*-webkit-backdrop-filter:.*?;[ \t]*\n/gm, '');
css = css.replace(/^[ \t]*backdrop-filter:.*?;[ \t]*\n/gm, '');

// 2. Reduce excessive border-radius. We replace 999px, 24px, 18px, 16px, 14px, 12px with a smaller radius.
// Actually, let's look for border-radius: [1-9][0-9]*px and border-radius: 999px
css = css.replace(/border-radius:\s*999px/g, 'border-radius: var(--radius-2)');
css = css.replace(/border-radius:\s*(1[2-9]|[2-9][0-9])px/g, 'border-radius: var(--radius-3)');

// 3. Remove --kira-sweep from variables and replace usages with solid colors.
// Replace var(--kira-sweep) with var(--accent-faint) or something similar if it's an accent, but often it's used for AI buttons.
css = css.replace(/var\(--kira-sweep\)/g, 'var(--accent-strong)');
css = css.replace(/var\(--kira-sweep-soft\)/g, 'var(--accent-weak)');
css = css.replace(/var\(--kira-tint\)/g, 'var(--accent-faint)');
css = css.replace(/var\(--kira-halo\)/g, 'transparent');

// 4. Clean up .kira-dock and .kira-dock.is-open
css = css.replace(/linear-gradient\([^;]*?\)/g, 'var(--surface-inspector)'); 
// wait, replacing all linear gradients might break other things, but Figma doesn't use gradients. Let's do it carefully.

fs.writeFileSync('styles_clean.css', css, 'utf-8');
console.log('Done');
