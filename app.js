// Minimal full-feature UI: connect, list topics, edit page, append imports
const $ = id => document.getElementById(id);
const statusEl=$('status'), repoEl=$('repo'), tokenEl=$('token'), saveBtn=$('save');
const refreshBtn=$('refresh'), filterEl=$('filter'), topicList=$('topicList');
const newTopicBtn=$('newTopic'), editorCard=$('editorCard'), edTitle=$('edTitle');
const editor=$('editor'), savePageBtn=$('savePage');
const importData=$('importData'), importTopic=$('importTopic'), importAppendBtn=$('importAppend');

function getCfg(){
  const url=new URL(location.href);
  const cfg=JSON.parse(localStorage.getItem('dumpmind_cfg')||'{}');
  if(url.searchParams.get('repo')) cfg.repo=url.searchParams.get('repo');
  if(url.searchParams.get('token')) cfg.token=url.searchParams.get('token');
  return cfg;
}
function setCfg(cfg){
  localStorage.setItem('dumpmind_cfg', JSON.stringify(cfg));
  if(repoEl) repoEl.value=cfg.repo||'';
  if(tokenEl) tokenEl.value=cfg.token||'';
}
function setStatus(msg){ if(statusEl) statusEl.textContent=msg; }

async function gh(path, opts={}){
  const {repo, token} = getCfg();
  if(!repo || !token) throw new Error('Missing repo or token');
  const resp = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: {'Authorization': `token ${token}`, 'Accept':'application/vnd.github+json'},
    ...opts
  });
  if(!resp.ok){ throw new Error(await resp.text()); }
  return resp.json();
}

async function loadIndex(){
  try{
    const data=await gh('contents/wiki/index.json');
    const json=JSON.parse(atob(data.content));
    renderTopics(json.topics||[]);
    setStatus(`Loaded index (${(json.topics||[]).length} topics)`);
  }catch(e){
    setStatus('index.json not found (will create on save)');
    renderTopics([]);
  }
}

function renderTopics(topics){
  const q=(filterEl?.value||'').toLowerCase();
  topicList.innerHTML='';
  (topics||[]).filter(t=>!q || (t.title||t.slug).toLowerCase().includes(q)).forEach(t=>{
    const li=document.createElement('li');
    const b=document.createElement('button');
    b.textContent=t.title||t.slug;
    b.onclick=()=>openTopic(t.slug||t.title);
    li.appendChild(b);
    topicList.appendChild(li);
  });
}

async function openTopic(slug){
  editorCard.style.display='block';
  edTitle.textContent=`Editing: ${slug}`;
  try{
    const f=await gh(`contents/wiki/topics/${slug}.md`);
    editor.value=atob(f.content);
  }catch{
    editor.value=`---
topic: ${slug}
tags: []
updated: ${new Date().toISOString().slice(0,10)}
---

# ${slug}

**Summary:**

## Facts
- 

## Disambiguation
- `;
  }
  editor.dataset.slug=slug;
}

async function savePage(){
  const slug=editor.dataset.slug; if(!slug) return;
  let sha=null; try{ const f=await gh(`contents/wiki/topics/${slug}.md`); sha=f.sha; }catch{}
  const content=btoa(unescape(encodeURIComponent(editor.value)));
  await gh(`contents/wiki/topics/${slug}.md`, {
    method:'PUT',
    body: JSON.stringify({ message:`update ${slug}.md`, content, sha })
  });
  await rebuildIndex(); await loadIndex(); alert('Saved');
}

async function rebuildIndex(){
  const list = await gh('contents/wiki/topics');
  const topics = await Promise.all(list.filter(i=>i.name.endsWith('.md')).map(async i=>{
    const file=await gh(`contents/wiki/topics/${i.name}`);
    const md=decodeURIComponent(escape(atob(file.content)));
    const m=md.match(/^---\n([\s\S]*?)\n---/);
    let meta={ topic:i.name.replace(/\.md$/,'') };
    if(m){
      m[1].split('\n').forEach(line=>{
        const mm=line.match(/^(\w+):\s*(.*)$/);
        if(mm){ meta[mm[1]]=mm[2]; }
      });
    }
    return { slug:i.name.replace(/\.md$/,''), title: meta.topic||i.name, tags: [], updated: meta.updated||null };
  }));
  const idx={ topics, updated:new Date().toISOString().slice(0,10) };
  let sha=null; try{ const f=await gh('contents/wiki/index.json'); sha=f.sha; }catch{}
  await gh('contents/wiki/index.json', {
    method:'PUT',
    body: JSON.stringify({ message:'rebuild index', content:btoa(JSON.stringify(idx,null,2)), sha })
  });
}

// Import (append lines as Facts)
function pruneLines(text){
  return (text||'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s && !/^(ok|k|lol|haha|omg|yup|yep|nah|👍|👌|❤️)$/i.test(s) && s.length>2);
}
function appendFacts(md, facts){
  let out=md;
  if(!/## Facts/i.test(out)) out += '\n\n## Facts\n';
  const add=facts.map(f=>'- '+f).join('\n');
  const re=/(## Facts[\s\S]*?)(\n## |\n# |\s*$)/i;
  const newOut=out.replace(re, (m,a,b)=> a+'\n'+add+'\n'+(b||''));
  return newOut===out ? (out+'\n'+add+'\n') : newOut;
}
async function importAppend(){
  const topic=(importTopic.value||'misc').trim().toLowerCase().replace(/\s+/g,'-');
  const lines=pruneLines(importData.value);
  if(!lines.length){ alert('Nothing to import'); return; }
  let md='', sha=null;
  try{ const f=await gh(`contents/wiki/topics/${topic}.md`); md=decodeURIComponent(escape(atob(f.content))); sha=f.sha; }
  catch{
    md=`---
topic: ${topic}
tags: []
updated: ${new Date().toISOString().slice(0,10)}
---

# ${topic}

**Summary:**

## Facts
- 

## Disambiguation
- `;
  }
  const newMd=appendFacts(md, lines);
  const content=btoa(unescape(encodeURIComponent(newMd)));
  await gh(`contents/wiki/topics/${topic}.md`, { method:'PUT', body: JSON.stringify({ message:`import -> ${topic}.md`, content, sha }) });
  await rebuildIndex(); await loadIndex();
  importData.value=''; alert(`Imported ${lines.length} line(s)`);
}

// Bind
saveBtn.onclick=()=>{ setCfg({repo:repoEl.value.trim(), token:tokenEl.value.trim()}); setStatus('Saved config'); };
refreshBtn.onclick=loadIndex;
newTopicBtn.onclick=()=>{ const slug=prompt('New topic slug (letters-numbers-dashes):','new-topic'); if(slug) openTopic(slug); };
savePageBtn.onclick=savePage;
importAppendBtn.onclick=importAppend;

// Init
setCfg(getCfg());
loadIndex();
