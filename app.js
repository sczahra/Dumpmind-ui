const $ = id => document.getElementById(id);

// load local config
const cfg = JSON.parse(localStorage.getItem("dm_cfg")||"{}");
if($("repo")) $("repo").value = cfg.repo||"";
if($("token")) $("token").value = cfg.token||"";
$("save").onclick = ()=>{
  cfg.repo = $("repo").value.trim();
  cfg.token = $("token").value.trim();
  localStorage.setItem("dm_cfg",JSON.stringify(cfg));
  alert("Saved!");
};

// GitHub helper
async function gh(p,o={}) {
  const r = await fetch(`https://api.github.com/repos/${cfg.repo}/${p}`,{
    headers:{Authorization:`token ${cfg.token}`},
    ...o
  });
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

// load topic index
async function loadIndex(){
  try{
    const {content} = await gh("contents/wiki/index.json");
    const d = JSON.parse(atob(content));
    renderTopics(d.topics||[]);
  }catch{ renderTopics([]); }
}
function renderTopics(t){
  const q = ($("filter").value||"").toLowerCase();
  $("topicList").innerHTML="";
  (t||[]).filter(x=>x.title.toLowerCase().includes(q)).forEach(x=>{
    const li=document.createElement("li");
    const b=document.createElement("button");
    b.textContent=x.title; b.onclick=()=>openTopic(x.slug);
    li.appendChild(b); $("topicList").appendChild(li);
  });
}
$("refresh").onclick=loadIndex;
$("filter").oninput=loadIndex;
$("newTopic").onclick=()=>openTopic(prompt("Topic slug?","new-topic"));

async function openTopic(slug){
  $("editorCard").style.display="block";
  $("edTitle").textContent=slug;
  $("editor").dataset.slug=slug;
  try{
    const f=await gh(`contents/wiki/topics/${slug}.md`);
    $("editor").value = decodeURIComponent(escape(atob(f.content)));
    $("editor").dataset.sha=f.sha;
  }catch{
    $("editor").value=`# ${slug}\n\n## Notes\n- `;
    $("editor").dataset.sha=null;
  }
}

$("savePage").onclick = async ()=>{
  const slug=$("editor").dataset.slug;
  const sha=$("editor").dataset.sha;
  const content=btoa(unescape(encodeURIComponent($("editor").value)));
  await gh(`contents/wiki/topics/${slug}.md`,{
    method:"PUT",
    body:JSON.stringify({message:`save ${slug}`,content,sha})
  });
  alert("Saved!");
};

loadIndex();

// ===== FLOATING + INBOX =====
$("inboxBtn").onclick = ()=> $("inboxModal").style.display="block";
$("inboxCancelBtn").onclick = ()=> {
  $("inboxText").value="";
  $("inboxModal").style.display="none";
};
$("inboxSaveBtn").onclick = async ()=>{
  const t=($("inboxText").value||"").trim();
  if(!t) return;
  const day=new Date().toISOString().slice(0,10);
  const slug=`inbox-${day}`;
  const path=`wiki/topics/${slug}.md`;

  let sha=null,md="";
  try{
    const f = await gh(`contents/${path}`);
    md = decodeURIComponent(escape(atob(f.content)));
    sha = f.sha;
  }catch{
    md = `# Inbox ${day}\n\n## Notes\n`;
  }
  md += `\n- ${t}`;
  const content=btoa(unescape(encodeURIComponent(md)));
  await gh(`contents/${path}`,{
    method:"PUT",
    body:JSON.stringify({message:`dump ${day}`,content,sha})
  });

  $("inboxModal").style.display="none";
  $("inboxText").value="";
};
