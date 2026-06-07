// Prebuild sync — downloads latest blog articles from GitHub (public repo, no auth needed)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
const REPO = 'hfa134500/astro-blog';
const BRANCH = 'master';

async function sync() {
  console.log('\n📥 Syncing blog content from GitHub...');
  fs.mkdirSync(BLOG_DIR, { recursive: true });

  try {
    const url = `https://api.github.com/repos/${REPO}/contents/src/content/blog?ref=${BRANCH}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'astro-blog' },
    });

    if (!res.ok) { console.warn(`⚠️ GitHub API ${res.status}`); return; }

    const files = await res.json();
    if (!Array.isArray(files)) { console.warn('⚠️ Unexpected response'); return; }

    const mdFiles = files.filter(f => f.name.endsWith('.md'));
    let count = 0;

    for (const file of mdFiles) {
      try {
        const dl = await fetch(file.download_url);
        if (!dl.ok) continue;
        fs.writeFileSync(path.join(BLOG_DIR, file.name), await dl.text(), 'utf-8');
        count++;
        console.log(`   ✅ ${file.name}`);
      } catch (e) {
        console.warn(`   ⚠️ ${file.name}: ${e.message}`);
      }
    }
    console.log(`📄 ${count} article(s) synced\n`);
  } catch (e) {
    console.warn('⚠️ Sync failed:', e.message);
  }
}

sync();
