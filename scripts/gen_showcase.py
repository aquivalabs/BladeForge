#!/usr/bin/env python3
"""Generate the static marketplace showcase (showcase/index.html) from catalog.json.

One source of truth: reads plugins/scout/skills/scout/catalog.json plus each skill's
own SKILL.md body and file tree, emits a self-contained HTML page. No hand-maintained
list, no server. Deployed to GitHub Pages.

Deliberately shows only REAL, curated data — purpose, when-it-fires, side effects, deps,
the file bundle (names only), and the measured trigger score from evals/result.json.
The SKILL.md BODY is NOT embedded: bodies can carry real identifiers, and this page is
public, so the site links to the body on GitHub instead of copying it. Effect and
security-scan metrics land here once stored per skill.
"""
import json, os, math, html as _html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, "plugins/scout/skills/scout/catalog.json")
OUT = os.path.join(ROOT, "showcase/index.html")

# ---------- OKLCH categorical palette: equal hue, fixed L/C, white text >=4.5:1 ----------
def oklch_srgb(L, C, Hdeg):
    H = math.radians(Hdeg); a = C*math.cos(H); b = C*math.sin(H)
    l_ = L+0.3963377774*a+0.2158037573*b; m_ = L-0.1055613458*a-0.0638541728*b; s_ = L-0.0894841775*a-1.2914855480*b
    l,m,s = l_**3, m_**3, s_**3
    R = 4.0767416621*l-3.3077115913*m+0.2309699292*s
    G = -1.2684380046*l+2.6097574011*m-0.3413193965*s
    B = -0.0041960863*l-0.7034186147*m+1.7076147010*s
    def g(x):
        x=max(0.0,min(1.0,x)); return 1.055*(x**(1/2.4))-0.055 if x>0.0031308 else 12.92*x
    return g(R),g(G),g(B)
def hexof(r,g,b): return '#%02x%02x%02x'%(round(r*255),round(g*255),round(b*255))

def palette(domains):
    N=len(domains); C=0.125
    # highest L (<=0.62) where white text stays >=4.5:1 on every hue
    def lum(r,g,bl):
        f=lambda x:max(0.0,min(1.0,x)); return 0.2126*f(r)+0.7152*f(g)+0.0722*f(bl)
    L=0.40; best=0.50
    while L<=0.62:
        worst=min((1.05)/(lum(*oklch_srgb(L,C,(i*360.0/N)+20))+0.05) for i in range(N))
        if worst>=4.5: best=L
        L+=0.005
    return {d: hexof(*oklch_srgb(best,C,(i*360.0/N)+20)) for i,d in enumerate(domains)}

# ---------- gather skills ----------
def load():
    d = json.load(open(CATALOG))
    items = d if isinstance(d,list) else d.get("skills", d.get("items", []))
    out=[]
    for it in items:
        sid = it.get("name"); plugin = it.get("plugin")
        folder = sid.split(":",1)[1] if ":" in sid else sid
        sdir = os.path.join(ROOT, f"plugins/{plugin}/skills/{folder}")
        tree=[]
        if os.path.isdir(sdir):
            for root,dirs,files in os.walk(sdir):
                dirs.sort()
                for f in sorted(files):
                    p=os.path.join(root,f)
                    tree.append({"path":os.path.relpath(p,sdir),"bytes":os.path.getsize(p)})
        # NOTE: the SKILL.md body is intentionally NOT read or embedded — see module docstring.
        # real measured metrics from evals/result.json (if present)
        trig=None; effect=None; security=None
        rp=os.path.join(sdir,"evals/result.json")
        if os.path.exists(rp):
            try:
                res=json.load(open(rp))
                r=res.get("trigger",{}) or {}
                if r.get("best_score"):
                    trig={"score":r.get("best_score"),"acc":r.get("accuracy"),
                          "baseline":r.get("baseline_accuracy"),"model":r.get("model"),
                          "runs":r.get("runs_per_query"),"at":r.get("measured_at"),
                          "type":r.get("eval_type")}
                a=res.get("acceptance") or {}
                if a.get("runner") and a.get("quality_impact") is not None:
                    effect={"qi":a.get("quality_impact"),"skillscore":a.get("skillscore"),
                            "verdict":a.get("verdict",""),"faults":a.get("guide_faults") or [],
                            "at":a.get("measured_at"),"model":a.get("model")}
                sec=res.get("security") or {}
                if sec.get("checklist"):
                    cl=sec["checklist"]
                    security={"verdict":sec.get("verdict"),"at":sec.get("scanned_at"),
                              "passed":sum(1 for c in cl if c.get("verdict")=="pass"),
                              "total":len(cl),"checklist":cl}
                else:
                    security=None
            except Exception:
                security=None
        ch=it.get("changes") or {}
        out.append({
            "id":sid,"plugin":plugin,"folder":folder,"version":it.get("plugin-version",""),
            "purpose":it.get("purpose","") or "","activates":it.get("activates-when","") or "",
            "best":it.get("best-for","") or "","needs":it.get("needs") or [],
            "tags":ch.get("tags") or [],"hooks":bool(it.get("hooks")),
            "tree":tree,"trig":trig,"effect":effect,"security":security,
        })
    out.sort(key=lambda s:s["id"])
    return out

def build():
    skills = load()
    domains = sorted({s["plugin"] for s in skills})
    pal = palette(domains)
    data = {"skills":skills, "palette":pal, "domains":domains}
    payload = json.dumps(data, ensure_ascii=False).replace("</script>","<\\/script>")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT,"w").write(TEMPLATE.replace("__DATA__", payload))
    print(f"gen_showcase: wrote {len(skills)} skills, {len(domains)} domains -> showcase/index.html")

TEMPLATE = r"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skill Marketplace</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
:root{--bg:#eceef3;--panel:#fff;--ink:#0f1420;--muted:#4b5568;--faint:#8790a1;--line:#e7eaf1;--line-2:#d7dce6;--accent:#4353d0;--hd:#6d28d9;
--t-files:#2f6fb0;--t-files-bg:#eaf2fa;--t-network:#9a6512;--t-network-bg:#f8efdb;--t-git:#7b48c0;--t-git-bg:#f1ebfb;--t-org:#1f7a6b;--t-org-bg:#e2f2ee;--t-money:#b23b3b;--t-money-bg:#f9e6e6;
--good:#1f8a54;--good-bg:#dcf0e5;--warn:#9a6a14;--warn-bg:#f7ecd6;--none:#8790a1;--none-bg:#e9ebf1;--shadow:0 1px 2px rgba(15,20,32,.05),0 6px 18px rgba(15,20,32,.07);--scrim:rgba(15,20,32,.44);}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0c0f15;--panel:#161a22;--ink:#f6f8fc;--muted:#c6cedd;--faint:#8b95a6;--line:#242a34;--line-2:#353d4a;--accent:#97a7ff;--hd:#c3a6f7;
--t-files:#7fb2e0;--t-files-bg:#18293c;--t-network:#e0b566;--t-network-bg:#352a18;--t-git:#bd97e8;--t-git-bg:#2a1c3d;--t-org:#68cdb8;--t-org-bg:#132e29;--t-money:#e88;--t-money-bg:#331b1b;
--good:#5fce8c;--good-bg:#153023;--warn:#e6b65c;--warn-bg:#332915;--none:#7b8496;--none-bg:#20252e;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 22px rgba(0,0,0,.5);--scrim:rgba(0,0,0,.64);}}
[data-theme=dark]{--bg:#0c0f15;--panel:#161a22;--ink:#f6f8fc;--muted:#c6cedd;--faint:#8b95a6;--line:#242a34;--line-2:#353d4a;--accent:#97a7ff;--hd:#c3a6f7;
--t-files:#7fb2e0;--t-files-bg:#18293c;--t-network:#e0b566;--t-network-bg:#352a18;--t-git:#bd97e8;--t-git-bg:#2a1c3d;--t-org:#68cdb8;--t-org-bg:#132e29;--t-money:#e88;--t-money-bg:#331b1b;
--good:#5fce8c;--good-bg:#153023;--warn:#e6b65c;--warn-bg:#332915;--none:#7b8496;--none-bg:#20252e;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 22px rgba(0,0,0,.5);--scrim:rgba(0,0,0,.64);}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
header{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:1rem clamp(1rem,4vw,2.5rem) .85rem}
.htop{display:flex;align-items:baseline;gap:.8rem;flex-wrap:wrap;max-width:80rem;margin:0 auto}
h1{font-size:1.4rem;font-weight:800;margin:0;letter-spacing:-.01em}h1 .d{color:var(--accent)}
.counts{font-family:"JetBrains Mono",monospace;font-size:.8rem;color:var(--muted)}.counts b{color:var(--ink);font-weight:600}
.controls{max-width:80rem;margin:.8rem auto 0;display:flex;flex-direction:column;gap:.6rem}
.search{width:100%;font:inherit;font-size:.95rem;padding:.6rem .9rem;border-radius:.6rem;border:1px solid var(--line-2);background:var(--panel);color:var(--ink)}
.search::placeholder{color:var(--faint)}.search:focus{outline:2px solid var(--accent);border-color:var(--accent)}
.filters{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
.flabel{font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-right:.2rem}
.chip{font:inherit;font-family:"JetBrains Mono",monospace;font-size:.74rem;padding:.24rem .6rem;border-radius:2rem;cursor:pointer;border:1px solid var(--line-2);background:var(--panel);color:var(--muted);white-space:nowrap}
.chip:hover{border-color:var(--accent);color:var(--ink)}.chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.chip .n{opacity:.6;font-size:.9em}
main{max-width:80rem;margin:1.4rem auto 4rem;padding:0 clamp(1rem,4vw,2.5rem)}
.grid{display:grid;gap:.85rem;grid-template-columns:1fr}
@media(min-width:640px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.grid{grid-template-columns:repeat(3,1fr)}}
.card{background:var(--panel);border:1px solid var(--line-2);border-radius:.75rem;overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;cursor:pointer}
.card:hover{box-shadow:0 2px 5px rgba(20,28,45,.08),0 12px 30px rgba(20,28,45,.14)}
.card:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.head{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.6rem .95rem;background:var(--dc,var(--accent))}
.id{font-family:"JetBrains Mono",monospace;font-size:.92rem;font-weight:600;color:#fff;word-break:break-word}.id .ns{color:rgba(255,255,255,.72)}
.ver{font-family:"JetBrains Mono",monospace;font-size:.7rem;color:rgba(255,255,255,.72);white-space:nowrap;font-weight:500}
.body{padding:.8rem .95rem .85rem;display:flex;flex-direction:column;gap:.55rem;flex:1}
.purpose{font-size:.87rem;color:var(--ink)}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem;margin-top:auto;padding-top:.2rem}
.badge{font-family:"JetBrains Mono",monospace;font-size:.66rem;font-weight:600;padding:.16rem .48rem;border-radius:.4rem}
.b-files{color:var(--t-files);background:var(--t-files-bg)}.b-network{color:var(--t-network);background:var(--t-network-bg)}
.b-git{color:var(--t-git);background:var(--t-git-bg)}.b-org{color:var(--t-org);background:var(--t-org-bg)}.b-money{color:var(--t-money);background:var(--t-money-bg)}
.b-ro{color:var(--faint);border:1px dashed var(--line-2)}
.sep{flex:1}.needs{font-family:"JetBrains Mono",monospace;font-size:.67rem;color:var(--muted)}.needs b{color:var(--ink);font-weight:600}
.metrics{display:flex;flex-wrap:wrap;gap:.4rem}
.mchip{display:inline-flex;align-items:center;gap:.35rem;padding:.22rem .55rem;border-radius:.5rem;font-family:"JetBrains Mono",monospace;font-size:.74rem;font-weight:700}
.mchip .ic{font-size:.82rem;line-height:1}.mchip .lab{font-size:.58rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.75}
.c-good{background:var(--good-bg,#dcf0e5);color:var(--good,#1f8a54)}.c-warn{background:var(--warn-bg,#f7ecd6);color:var(--warn,#9a6a14)}.c-none{background:var(--none-bg);color:var(--none)}
.measure{display:grid;grid-template-columns:repeat(auto-fill,minmax(7rem,1fr));gap:.5rem}
.mcell{border:1px solid var(--line);border-radius:.55rem;padding:.5rem .6rem}
.mcell .k{font-family:"JetBrains Mono",monospace;font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--faint)}
.mcell .v{font-family:"JetBrains Mono",monospace;font-size:1.05rem;font-weight:700;margin-top:.15rem;color:var(--ink)}
.mcell small{display:block;font-family:"JetBrains Mono",monospace;font-size:.6rem;color:var(--faint);margin-top:.2rem}
.scan{display:grid;gap:.3rem}
.scan .row{display:flex;align-items:center;gap:.5rem;font-size:.82rem;padding:.28rem .1rem;border-bottom:1px solid var(--line)}
.scan .row:last-child{border-bottom:none}
.scan .st{width:1.1rem;text-align:center;flex:none}.scan .pass{color:var(--good)}.scan .flag{color:var(--warn)}
.scan .nm{color:var(--ink)}.scan .dt{color:var(--muted);font-size:.75rem;margin-left:auto;text-align:right;max-width:60%}
.empty{text-align:center;color:var(--faint);padding:3rem;font-family:"JetBrains Mono",monospace}
footer{max-width:80rem;margin:0 auto;padding:1.2rem clamp(1rem,4vw,2.5rem) 2.5rem;border-top:1px solid var(--line);color:var(--faint);font-size:.78rem}
footer code{font-family:"JetBrains Mono",monospace;color:var(--muted)}
/* modal */
.scrim{position:fixed;inset:0;background:var(--scrim);backdrop-filter:blur(2px);display:none;align-items:flex-start;justify-content:center;padding:clamp(1rem,5vh,4rem) 1rem;z-index:50;overflow-y:auto}
.scrim.open{display:flex}
.modal{background:var(--panel);border:1px solid var(--line-2);border-radius:.9rem;overflow:hidden;width:100%;max-width:40rem;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.m-head{padding:1rem 1.2rem;background:var(--dc,var(--accent));display:flex;align-items:flex-start;justify-content:space-between;gap:.8rem}
.m-head .id{font-size:1.1rem}
.m-close{background:rgba(255,255,255,.18);border:none;color:#fff;width:1.9rem;height:1.9rem;border-radius:.5rem;font-size:1.1rem;cursor:pointer;flex:none;line-height:1}
.m-close:hover{background:rgba(255,255,255,.32)}
.m-body{padding:1.1rem 1.2rem 1.3rem;display:flex;flex-direction:column;gap:1.1rem}
.m-purpose{font-size:.95rem;color:var(--ink)}
.m-install{font-family:"JetBrains Mono",monospace;font-size:.78rem;background:var(--bg);border:1px solid var(--line-2);border-radius:.5rem;padding:.55rem .7rem;color:var(--muted);display:flex;gap:.5rem}
.m-install b{color:var(--ink);font-weight:600}
.srcrow{display:flex;flex-wrap:wrap;gap:.5rem}
.srclink{display:inline-flex;align-items:center;gap:.4rem;font-family:"JetBrains Mono",monospace;font-size:.78rem;font-weight:600;text-decoration:none;color:#fff;background:var(--accent);padding:.5rem .8rem;border-radius:.5rem}
.srclink:hover{filter:brightness(1.08)}.srclink.ghost{color:var(--accent);background:transparent;border:1px solid var(--accent)}
.m-sec>h3{font-family:"JetBrains Mono",monospace;font-size:.72rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--hd);margin:0 0 .6rem;padding-bottom:.35rem;border-bottom:1px solid color-mix(in srgb,var(--hd) 30%,transparent)}
.when{font-size:.85rem;color:var(--ink);border-left:2px solid color-mix(in srgb,var(--hd) 45%,transparent);padding-left:.7rem}
.kv{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
.kv .lab{font-family:"JetBrains Mono",monospace;font-size:.64rem;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);margin-right:.2rem}
.kv code{font-family:"JetBrains Mono",monospace;font-size:.72rem;background:var(--panel);border:1px solid var(--line-2);color:var(--accent);padding:.14rem .45rem;border-radius:.35rem;cursor:pointer}
.tree{font-family:"JetBrains Mono",monospace;font-size:.76rem;display:grid;gap:.15rem}
.tree .f{display:flex;gap:.5rem;color:var(--ink)}.tree .f .lead{color:var(--faint)}.tree .f .sz{margin-left:auto;color:var(--faint);font-size:.7rem}
.tree .f.md{font-weight:600}
.bodybox{background:var(--bg);border:1px solid var(--line-2);border-radius:.55rem;max-height:26rem;overflow:auto;padding:.9rem 1.05rem}
.bmeta{font-family:"JetBrains Mono",monospace;font-size:.68rem;color:var(--faint);margin-bottom:.4rem}
.prose{font-size:.86rem;line-height:1.6;color:var(--ink)}.prose>:first-child{margin-top:0}.prose>:last-child{margin-bottom:0}
.prose h1,.prose h2,.prose h3,.prose h4{font-weight:700;line-height:1.3;margin:1.1rem 0 .4rem}
.prose h1{font-size:1.05rem}.prose h2{font-size:.98rem}.prose h3{font-size:.9rem}.prose h4{font-size:.84rem;color:var(--muted)}
.prose p{margin:.5rem 0}.prose ul,.prose ol{margin:.5rem 0;padding-left:1.3rem}.prose li{margin:.22rem 0}.prose li::marker{color:var(--accent)}
.prose strong{font-weight:700}.prose em{font-style:italic;color:var(--muted)}
.prose a{color:var(--accent);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--accent) 40%,transparent)}
.prose code{font-family:"JetBrains Mono",monospace;font-size:.82em;background:var(--panel);border:1px solid var(--line);border-radius:.3rem;padding:.05em .35em;color:var(--accent)}
.prose pre{background:var(--panel);border:1px solid var(--line);border-radius:.5rem;padding:.7rem .8rem;overflow-x:auto;margin:.6rem 0}
.prose pre code{background:none;border:none;padding:0;color:var(--ink);font-size:.8rem}
.prose hr{border:none;border-top:1px solid var(--line-2);margin:1rem 0}
.prose table{border-collapse:collapse;width:100%;margin:.6rem 0;font-size:.8rem;display:block;overflow-x:auto}
.prose th,.prose td{border:1px solid var(--line-2);padding:.32rem .55rem;text-align:left;vertical-align:top}.prose th{background:var(--panel);font-weight:600}
</style></head><body>
<header>
  <div class="htop"><h1>Skill Marketplace<span class="d">.</span></h1>
    <span class="counts"><b id="shown">0</b> shown · <b id="total">0</b> skills · <b id="doms">0</b> domains</span></div>
  <div class="controls">
    <input class="search" id="q" type="search" placeholder="Search id, purpose, or trigger…" autocomplete="off">
    <div class="filters" id="df"><span class="flabel">domain</span></div>
  </div>
</header>
<main><div class="grid" id="grid"></div><div class="empty" id="empty" hidden>no skills match</div></main>
<footer>Generated from <code>catalog.json</code> by <code>scripts/gen_showcase.py</code> — one source, no hand-maintained list.
Each card shows what a skill does, when it fires, what it touches, and links out to its <code>SKILL.md</code> on GitHub. Quality &amp; security metrics land here once measured.</footer>
<div class="scrim" id="scrim"><div class="modal" id="modal"></div></div>
<script id="data" type="application/json">__DATA__</script>
<script>
const D=JSON.parse(document.getElementById('data').textContent);
const PAL=D.palette, SK=D.skills, DOMS=D.domains;
const REPO="https://github.com/aquivalabs/BladeForge";
const esc=s=>(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const st={q:'',dom:null};
document.getElementById('total').textContent=SK.length;
document.getElementById('doms').textContent=DOMS.length;
const df=document.getElementById('df');
DOMS.forEach(d=>{const n=SK.filter(s=>s.plugin===d).length;const b=document.createElement('button');
  b.className='chip';b.setAttribute('aria-pressed','false');b.dataset.dom=d;b.innerHTML=`${d} <span class="n">${n}</span>`;
  b.onclick=()=>{st.dom=st.dom===d?null:d;sync();render();};df.appendChild(b);});
function sync(){df.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.dom===st.dom));}
document.getElementById('q').addEventListener('input',e=>{st.q=e.target.value.toLowerCase().trim();render();});
function tagBadges(t){return t.length?t.map(x=>`<span class="badge b-${x}">${x}</span>`).join(''):'<span class="badge b-ro">read-only</span>';}
function trigCls(a){return a==null?'c-none':(a>=0.7?'c-good':'c-warn');}
function effCls(q){return q==null?'c-none':(q>=0.5?'c-good':(q>0?'c-warn':'c-warn'));}
function trigChip(s){const chips=[];
  if(s.trig)chips.push(`<span class="mchip ${trigCls(s.trig.acc)}"><span class="ic">🎯</span><span class="lab">trig</span>${esc(s.trig.score)}</span>`);
  if(s.effect)chips.push(`<span class="mchip ${effCls(s.effect.qi)}"><span class="ic">⚡</span><span class="lab">effect</span>${(s.effect.qi>=0?'+':'')+s.effect.qi.toFixed(2)}</span>`);
  if(s.security)chips.push(`<span class="mchip ${s.security.passed===s.security.total?'c-good':'c-warn'}"><span class="ic">🛡</span><span class="lab">scan</span>${s.security.passed}/${s.security.total}</span>`);
  return chips.length?`<div class="metrics">${chips.join('')}</div>`:'';}
function scanBlock(s){if(!s.security)return'';const sec=s.security;
  return `<div class="m-sec"><h3>security scan · ${sec.passed}/${sec.total}</h3><div class="scan">${sec.checklist.map(c=>{
    const flag=c.verdict!=='pass';
    return `<div class="row"><span class="st ${flag?'flag':'pass'}">${flag?'▲':'✓'}</span><span class="nm">${esc(c.point)}</span><span class="dt">${esc(c.note||'')}</span></div>`;
  }).join('')}</div><div class="bmeta" style="margin-top:.5rem">scanned ${esc((sec.at||'').slice(0,10))} · cerberus:security-scan</div></div>`;}
function measureBlock(s){if(!s.trig)return'';const t=s.trig;
  const pct=t.acc!=null?Math.round(t.acc*100)+'%':'—';const base=t.baseline!=null?Math.round(t.baseline*100)+'%':'—';
  return `<div class="m-sec"><h3>measured · trigger</h3><div class="measure">
    <div class="mcell"><div class="k">best score</div><div class="v ${trigCls(t.acc)}">${esc(t.score)}</div><small>description-triggering</small></div>
    <div class="mcell"><div class="k">accuracy</div><div class="v">${pct}</div><small>vs baseline ${base}</small></div>
    <div class="mcell"><div class="k">runs/query</div><div class="v">${t.runs||'—'}</div><small>model ${esc(t.model||'—')}</small></div>
  </div><div class="bmeta" style="margin-top:.5rem">measured ${esc((t.at||'').slice(0,10))} · security scan lands here once stored per skill</div></div>`;}
function effectBlock(s){if(!s.effect)return'';const e=s.effect;
  return `<div class="m-sec"><h3>measured · effect (skillaxe)</h3><div class="measure">
    <div class="mcell"><div class="k">quality impact</div><div class="v ${effCls(e.qi)}">${(e.qi>=0?'+':'')+e.qi.toFixed(2)}</div><small>d·m, −1…+1</small></div>
    <div class="mcell"><div class="k">skillscore</div><div class="v">${e.skillscore!=null?e.skillscore.toFixed(2):'—'}</div><small>rubric adherence 0–1</small></div>
    <div class="mcell"><div class="k">guide faults</div><div class="v ${e.faults.length?'':'c-good'}">${e.faults.length||'0'}</div><small>fixable in the guide</small></div>
  </div>${e.verdict?`<div class="when" style="margin-top:.6rem">${esc(e.verdict)}</div>`:''}<div class="bmeta" style="margin-top:.5rem">measured ${esc((e.at||'').slice(0,10))} · model ${esc(e.model||'—')} · with/without run</div></div>`;}
function match(s){if(st.dom&&s.plugin!==st.dom)return false;
  if(st.q){const h=(s.id+' '+s.purpose+' '+s.activates+' '+s.best).toLowerCase();if(!h.includes(st.q))return false;}return true;}
function card(s){const el=document.createElement('article');el.className='card';el.style.setProperty('--dc',PAL[s.plugin]);
  el.tabIndex=0;el.setAttribute('role','button');const[ns,nm]=s.id.split(':');
  el.innerHTML=`<div class="head"><span class="id"><span class="ns">${ns}:</span>${nm||''}</span><span class="ver">v${s.version}</span></div>
    <div class="body"><div class="purpose">${esc(s.purpose)}</div>
    ${trigChip(s)}
    <div class="meta">${tagBadges(s.tags)}<span class="sep"></span>${s.needs.length?`<span class="needs"><b>needs</b> ${s.needs.length}</span>`:''}</div></div>`;
  el.onclick=()=>open(s);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(s);}};return el;}
function render(){const sh=SK.filter(match);const g=document.getElementById('grid');g.innerHTML='';sh.forEach(s=>g.appendChild(card(s)));
  document.getElementById('shown').textContent=sh.length;document.getElementById('empty').hidden=sh.length>0;}
// markdown
function md(src){const L=src.replace(/\r/g,'').split('\n');let h='',i=0;
 const inl=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<em>$2</em>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
 while(i<L.length){let l=L[i];
  if(/^```/.test(l)){let c=[];i++;while(i<L.length&&!/^```/.test(L[i])){c.push(L[i]);i++;}i++;h+='<pre><code>'+esc(c.join('\n'))+'</code></pre>';continue;}
  if(/^#{1,4}\s/.test(l)){const n=l.match(/^#+/)[0].length;h+=`<h${n}>${inl(l.replace(/^#+\s/,''))}</h${n}>`;i++;continue;}
  if(/^---+\s*$/.test(l)){h+='<hr>';i++;continue;}
  if(/^\s*\|.*\|/.test(l)){const t=[];while(i<L.length&&/^\s*\|.*\|/.test(L[i])){t.push(L[i]);i++;}
   const cs=r=>r.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());const hd=cs(t[0]);
   const rows=t.slice(t[1]&&/^[\s|:-]+$/.test(t[1])?2:1);
   h+='<table><thead><tr>'+hd.map(x=>`<th>${inl(x)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cs(r).map(x=>`<td>${inl(x)}</td>`).join('')+'</tr>').join('')+'</tbody></table>';continue;}
  if(/^\s*[-*]\s/.test(l)){h+='<ul>';while(i<L.length&&/^\s*[-*]\s/.test(L[i])){h+=`<li>${inl(L[i].replace(/^\s*[-*]\s/,''))}</li>`;i++;}h+='</ul>';continue;}
  if(/^\s*\d+\.\s/.test(l)){h+='<ol>';while(i<L.length&&/^\s*\d+\.\s/.test(L[i])){h+=`<li>${inl(L[i].replace(/^\s*\d+\.\s/,''))}</li>`;i++;}h+='</ol>';continue;}
  if(l.trim()===''){i++;continue;}
  let p=[];while(i<L.length&&L[i].trim()!==''&&!/^(#{1,4}\s|```|\s*\||\s*[-*]\s|\s*\d+\.\s|---+\s*$)/.test(L[i])){p.push(L[i]);i++;}
  h+=`<p>${inl(p.join(' '))}</p>`;}return h;}
const scrim=document.getElementById('scrim'),modal=document.getElementById('modal');
function treeBlock(s){const kb=n=>n<1024?n+' B':(n/1024).toFixed(1)+' KB';
 return `<div class="tree">${s.tree.map(f=>{const parts=f.path.split('/');const name=parts.pop();const lead=parts.length?parts.join('/')+'/':'';
  return `<div class="f${f.path==='SKILL.md'?' md':''}"><span><span class="lead">${esc(lead)}</span>${esc(name)}</span><span class="sz">${kb(f.bytes)}</span></div>`;}).join('')}</div>`;}
function open(s){const[ns,nm]=s.id.split(':');modal.style.setProperty('--dc',PAL[s.plugin]);
 modal.innerHTML=`<div class="m-head"><span class="id"><span class="ns">${ns}:</span>${nm}</span><button class="m-close" aria-label="close">✕</button></div>
  <div class="m-body">
    <div class="m-purpose">${esc(s.purpose)}</div>
    <div class="m-install"><b>install</b> /plugin install ${ns}@aquivalabs</div>
    <div class="srcrow"><a class="srclink" href="${REPO}/tree/main/plugins/${ns}/skills/${nm}" target="_blank" rel="noopener">↗ source on GitHub</a>
      <a class="srclink ghost" href="${REPO}/blob/main/plugins/${ns}/skills/${nm}/SKILL.md" target="_blank" rel="noopener">SKILL.md</a></div>
    ${measureBlock(s)}
    ${effectBlock(s)}
    ${scanBlock(s)}
    <div class="m-sec"><h3>fires when</h3><div class="when">${esc(s.activates)}</div></div>
    ${s.best?`<div class="m-sec"><h3>best for</h3><div class="when">${esc(s.best)}</div></div>`:''}
    <div class="m-sec"><h3>side effects &amp; deps</h3>
      <div class="kv" style="margin-bottom:.4rem">${tagBadges(s.tags)}${s.hooks?'<span class="badge b-ro">hook</span>':''}</div>
      <div class="kv"><span class="lab">needs</span>${s.needs.length?s.needs.map(n=>`<code data-j="${n}">${n}</code>`).join(''):'<span class="when" style="border:none;padding:0">nothing</span>'}</div></div>
    <div class="m-sec"><h3>what's inside</h3>${treeBlock(s)}</div>
    <div class="m-sec"><h3>SKILL.md</h3><div class="when">Full instructions live in the repo — <a href="${REPO}/blob/main/plugins/${ns}/skills/${nm}/SKILL.md" target="_blank" rel="noopener" style="color:var(--accent)">read SKILL.md on GitHub ↗</a> · ${s.tree.length} files in the bundle.</div></div>
  </div>`;
 modal.querySelector('.m-close').onclick=close;
 modal.querySelectorAll('code[data-j]').forEach(c=>c.onclick=()=>{const t=SK.find(x=>x.id===c.dataset.j);if(t)open(t);else{close();st.q=c.dataset.j.toLowerCase();document.getElementById('q').value=c.dataset.j;st.dom=null;sync();render();}});
 scrim.classList.add('open');document.body.style.overflow='hidden';}
function close(){scrim.classList.remove('open');document.body.style.overflow='';}
scrim.onclick=e=>{if(e.target===scrim)close();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
render();
</script></body></html>"""

if __name__ == "__main__":
    build()
