// helpers
const $ = id => document.getElementById(id);
const cfg = JSON.parse(localStorage.getItem("dm_cfg")||"{}");
if($("repo")) $("repo").value = cfg.repo||"";
if($("token")) $("token").value = cfg.token||"";
$("save").onclick = ()=>{
  cfg.repo = $("repo").value.trim();
  cfg.token = $("token").value.trim();
  localStorage.setItem("dm_cfg", JSON.stringify(cfg));
  alert("Saved!");
};

// GitHub REST helper
async function gh(path, opts={}) {
  const r = await fetch(`https://api.github.com/repos/${cfg.repo}/${path}`, {
    headers:{Authorization:`token ${cfg.token}`,'Accept':'application/vnd.github+json'},
    ...opts
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

// -------- Topics basic --------
async function loadIndex(){
  try{
    const {content} = await gh("contents/wiki/index.json");
    const data = JSON.parse(atob(content));
    renderTopics(data.topics||[]);
  }catch{ renderTopics([]); }
}
function renderTopics(list){
  const q = ($("filter").value||"").toLowerCase();
  $("topicList").innerHTML = "";
  (list||[]).filter(t => (t.title||t.slug||"").toLowerCase().includes(q))
    .forEach(t=>{
      const li=document.createElement("li");
      const b=document.createElement("button");
      b.textContent=t.title||t.slug;
      b.onclick=()=>openTopic(t.slug||t.title);
      li.appendChild(b); $("topicList").appendChild(li);
    });
}
$("refresh").onclick = loadIndex;
$("filter").oninput = loadIndex;
$("newTopic").onclick = ()=>openTopic(prompt("Topic slug?","new-topic"));

async function openTopic(slug){
  $("editorCard").style.display="block";
  $("edTitle").textContent=slug;
  $("editor").dataset.slug=slug;
  try{
    const f = await gh(`contents/wiki/topics/${slug}.md`);
    $("editor").value = decodeURIComponent(escape(atob(f.content)));
    $("editor").dataset.sha = f.sha;
  }catch{
    $("editor").value = `# ${slug}\n\n## Notes\n- `;
    $("editor").dataset.sha = null;
  }
}
$("savePage").onclick = async ()=>{
  const slug=$("editor").dataset.slug, sha=$("editor").dataset.sha;
  const content=btoa(unescape(encodeURIComponent($("editor").value)));
  await gh(`contents/wiki/topics/${slug}.md`,{
    method:"PUT",
    body:JSON.stringify({message:`save ${slug}`,content,sha})
  });
  alert("Saved!");
};

// -------- Import from landfill --------
$("openImportBtn").onclick = ()=> document.getElementById("importCard").scrollIntoView({behavior:"smooth"});
$("importAppend").onclick = async ()=>{
  const topic = ($("importTopic").value||"misc").trim().toLowerCase().replace(/\s+/g,'-');
  const lines = ($("importData").value||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length) return alert("Nothing to import.");
  const path = `wiki/topics/${topic}.md`;
  let sha=null, md="";
  try{
    const f = await gh(`contents/${path}`);
    md = decodeURIComponent(escape(atob(f.content)));
    sha = f.sha;
  }catch{
    md = `# ${topic}\n\n## Notes\n- `;
  }
  md += "\n" + lines.map(x=>"- "+x).join("\n");
  const content=btoa(unescape(encodeURIComponent(md)));
  await gh(`contents/${path}`,{method:"PUT",body:JSON.stringify({message:`import -> ${topic}`,content,sha})});
  $("importData").value=""; alert(`Imported ${lines.length} line(s)`);
};

// -------- Floating + inbox (daily: inbox-YYYY-MM-DD.md) --------
$("inboxBtn").onclick = ()=> $("inboxModal").style.display="block";
$("inboxCancelBtn").onclick = ()=> { $("inboxText").value=""; $("inboxModal").style.display="none"; };
$("inboxSaveBtn").onclick = async ()=>{
  const txt = ($("inboxText").value||"").trim();
  if(!txt) return;
  const day = new Date().toISOString().slice(0,10);
  const slug = `inbox-${day}`;
  const path = `wiki/topics/${slug}.md`;
  let sha=null, md="";
  try{
    const f = await gh(`contents/${path}`);
    md = decodeURIComponent(escape(atob(f.content)));
    sha = f.sha;
  }catch{
    md = `# Inbox ${day}\n\n## Notes\n`;
  }
  md += `\n- ${txt}`;
  const content=btoa(unescape(encodeURIComponent(md)));
  await gh(`contents/${path}`,{method:"PUT",body:JSON.stringify({message:`dump ${day}`,content,sha})});
  $("inboxText").value=""; $("inboxModal").style.display="none";
};

// -------- Auto-file Today (very simple keyword routing) --------
const ROUTES = [
  {slug:"childhood", re:/(childhood|school|kid|teen|mom|dad|grandma|grandpa|bully|playground|teacher)/i},
  {slug:"work",      re:/(work|job|manager|boss|meeting|deadline|client|project|salary|raise|offer|coworker)/i},
  {slug:"health",    re:/(health|doctor|therapy|therapist|anxiety|depress|meds|exercise|sleep|pain|injury)/i},
  {slug:"money",     re:/(money|bank|budget|rent|mortgage|credit|debt|loan|tax|invoice|payment|$)/i},
  {slug:"relationships", re:/(relationship|date|partner|boyfriend|girlfriend|husband|wife|friend|breakup|argue)/i},
  {slug:"travel",    re:/(travel|flight|airport|hotel|trip|vacation|train|drive|itinerary)/i}
];
function routeLine(s){
  for(const r of ROUTES){ if(r.re.test(s)) return r.slug; }
  return "misc";
}
$("autofileBtn").onclick = async ()=>{
  const day = new Date().toISOString().slice(0,10);
  const inboxPath = `wiki/topics/inbox-${day}.md`;
  let md="";
  try{
    const f = await gh(`contents/${inboxPath}`);
    md = decodeURIComponent(escape(atob(f.content)));
  }catch{ return alert("No inbox for today yet."); }

  const lines = (md.match(/^- (.+)$/gm)||[]).map(x=>x.replace(/^- /,'').trim()).filter(Boolean);
  if(!lines.length) return alert("No lines to auto-file.");

  let moved=0;
  for(const line of lines){
    const slug = routeLine(line);
    const path = `wiki/topics/${slug}.md`;
    let sha=null, tmd="";
    try{
      const f = await gh(`contents/${path}`); tmd = decodeURIComponent(escape(atob(f.content))); sha=f.sha;
    }catch{ tmd = `# ${slug}\n\n## Notes\n- `; }
    tmd += `\n- ${line}`;
    const content=btoa(unescape(encodeURIComponent(tmd)));
    await gh(`contents/${path}`,{method:"PUT",body:JSON.stringify({message:`auto-file to ${slug}`,content,sha})});
    moved++;
  }
  alert(`Auto-filed ${moved} item(s).`);
};

// -------- Daily Digest (copies today's inbox to /wiki/digests/yyyy-mm-dd.md) --------
$("digestBtn").onclick = async ()=>{
  const day = new Date().toISOString().slice(0,10);
  const inboxPath = `wiki/topics/inbox-${day}.md`;
  let md="";
  try{
    const f = await gh(`contents/${inboxPath}`);
    md = decodeURIComponent(escape(atob(f.content)));
  }catch{ return alert("No inbox for today yet."); }

  const digest = `# Daily Digest ${day}\n\n` + md;
  const dpath = `wiki/digests/${day}.md`;
  let sha=null;
  try{ const f=await gh(`contents/${dpath}`); sha=f.sha; }catch{}
  const content=btoa(unescape(encodeURIComponent(digest)));
  await gh(`contents/${dpath}`,{method:"PUT",body:JSON.stringify({message:`daily digest ${day}`,content,sha})});
  alert("Daily Digest saved to wiki/digests/" + day + ".md");
};

// boot
loadIndex();
