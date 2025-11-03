// basic config storage
const $ = id => document.getElementById(id);
const status = ()=>{};
const cfg = JSON.parse(localStorage.getItem("dm_cfg")||"{}");
function saveCfg(){ localStorage.setItem("dm_cfg", JSON.stringify(cfg)); }

if($("repo")) $("repo").value = cfg.repo || "";
if($("token")) $("token").value = cfg.token || "";

$("save").onclick = () => {
  cfg.repo = $("repo").value.trim();
  cfg.token = $("token").value.trim();
  saveCfg();
  alert("Saved!");
};

// GitHub helper
async function gh(path, opts={}) {
  const resp = await fetch(
    `https://api.github.com/repos/${cfg.repo}/${path}`,
    { headers:{Authorization:`token ${cfg.token}`}, ...opts }
  );
  if(!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

// load topics
async function loadIndex(){
  try{
    const {content} = await gh("contents/wiki/index.json");
    const data = JSON.parse(atob(content));
    renderTopics(data.topics||[]);
  } catch(e){ renderTopics([]); }
}

function renderTopics(list){
  const q = ($("filter").value||"").toLowerCase();
  $("topicList").innerHTML = "";
  list.filter(t => (t.title||"").toLowerCase().includes(q))
    .forEach(t=>{
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.textContent = t.title;
      b.onclick = ()=>openTopic(t.slug);
      li.appendChild(b);
      $("topicList").appendChild(li);
  });
}

$("refresh").onclick = loadIndex;
$("filter").oninput = loadIndex;
$("newTopic").onclick = ()=>openTopic(prompt("Topic slug?","new-topic"));

async function openTopic(slug){
  $("editorCard").style.display="block";
  $("edTitle").textContent = slug;
  $("editor").dataset.slug = slug;

  try{
    const f = await gh(`contents/wiki/topics/${slug}.md`);
    $("editor").value = decodeURIComponent(escape(atob(f.content)));
    $("editor").dataset.sha = f.sha;
  }catch{
    $("editor").value = `# ${slug}\n\n## Notes\n- `;
    $("editor").dataset.sha = null;
  }
}

$("savePage").onclick = async () => {
  const slug = $("editor").dataset.slug;
  const sha = $("editor").dataset.sha;
  const content = btoa(unescape(encodeURIComponent($("editor").value)));
  await gh(`contents/wiki/topics/${slug}.md`,{
    method:"PUT",
    body:JSON.stringify({message:`save ${slug}`,content,sha})
  });
  alert("Saved!");
};

// ==============
// Float + inbox
// ==============
$("inboxBtn").onclick = ()=> $("inboxModal").style.display = "block";
$("inboxCancelBtn").onclick = ()=> {
  $("inboxModal").style.display = "none"; $("inboxText").value="";
};

$("inboxSaveBtn").onclick = async () => {
  const txt = $("inboxText").value.trim();
  if(!txt) return;

  const day = new Date().toISOString().slice(0,10);
  const slug = `inbox-${day}`;
  const path = `wiki/topics/${slug}.md`;

  let sha=null,md="";
  try{
    const f = await gh(`contents/${path}`);
    md = decodeURIComponent(escape(atob(f.content)));
    sha = f.sha;
  }catch{
    md = `# Inbox ${day}\n\n## Notes\n`;
  }

  md += `\n- ${txt}`;
  const content = btoa(unescape(encodeURIComponent(md)));

  await gh(`contents/${path}`,{
    method:"PUT",
    body:JSON.stringify({message:`dump ${day}`,content,sha})
  });

  $("inboxModal").style.display="none";
  $("inboxText").value="";
};
loadIndex();
