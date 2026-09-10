#!/usr/bin/env python3
"""Generate the static marketplace showcase from catalog.json.

One source of truth: reads plugins/scout/skills/scout/catalog.json plus each skill's
own file tree and evals/result.json, emits a multi-page static site under showcase/:

    showcase/index.html                 landing — hero duo + flagship row + full grid
    showcase/skill/<plugin>__<name>.html one page per skill (no modal)
    showcase/skill/cicero.html          curated page for the CICERO plugin (no SKILL.md)
    showcase/assets/base.css            shared styles
    showcase/assets/dots.js             the interactive point-field background

Deliberately shows only REAL, curated data — purpose, when-it-fires, side effects, deps,
the file bundle (names only), and the measured trigger/effect/security metrics from
evals/result.json. The SKILL.md BODY is NOT embedded: bodies can carry real identifiers,
and this page is public, so each page links to the body on GitHub instead of copying it.
"""
import json, os, math, html as _html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, "plugins/scout/skills/scout/catalog.json")
OUTDIR = os.path.join(ROOT, "showcase")

# --- repo identity (transformed per mirror) ---
REPO = "https://github.com/aquivalabs/BladeForge"
MARKET = "bladeforge"

# --- featured curation ---
HERO_IDS = ["scout:scout", "cicero"]
FLAGSHIP_IDS = ["cerberus:security-scan", "review:setup", "critique:critique", "diagram:diagram"]
# short marketing taglines for the featured cards (never invented facts — a plain gloss)
TAGLINE = {
    "scout:scout": "Find the right skill. The catalogue that answers “what should I use for this?” before you build.",
    "cicero": "The house voice. Result first, plain words, honesty about verification — an always-on output style, not a skill you invoke.",
    "cerberus:security-scan": "The safety gate. An eight-point consumer-safety scan before a skill runs on anyone else’s machine.",
    "review:setup": "The pre-push review gate. Eight reviewer lenses plus a deterministic secret scan, wired into the push.",
    "critique:critique": "Adversarial design review. Independent critics tear a spec apart from named angles before you commit.",
    "diagram:diagram": "Draw how the software works. Architecture, class, data-flow and dependency views from the source.",
}

# curated non-skill plugin entries (no catalog row, no SKILL.md)
CURATED = {
    "cicero": {
        "id": "cicero", "plugin": "cicero", "folder": None, "slug": "cicero",
        "purpose": "The house communication style — the numbered readability rules, shipped as an always-on output style at the system-prompt level.",
        "kind": "output-style + hooks",
    },
}

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
                              "passed":sum(1 for c in cl if c.get("verdict")!="flag"),
                              "total":len(cl),"checklist":cl}
            except Exception:
                security=None
        ch=it.get("changes") or {}
        out.append({
            "id":sid,"plugin":plugin,"folder":folder,"slug":f"{plugin}__{folder}",
            "version":it.get("plugin-version",""),
            "purpose":it.get("purpose","") or "","activates":it.get("activates-when","") or "",
            "best":it.get("best-for","") or "","needs":it.get("needs") or [],
            "tags":ch.get("tags") or [],"hooks":bool(it.get("hooks")),
            "tree":tree,"trig":trig,"effect":effect,"security":security,
        })
    out.sort(key=lambda s:s["id"])
    return out

# ---------- small HTML helpers ----------
def esc(s): return _html.escape(str(s or ""))

def tag_badges(tags):
    if not tags: return '<span class="badge b-ro">read-only</span>'
    return "".join(f'<span class="badge b-{esc(t)}">{esc(t)}</span>' for t in tags)

def trig_cls(a): return "c-none" if a is None else ("c-good" if a>=0.7 else "c-warn")
def eff_cls(q):  return "c-none" if q is None else ("c-good" if q>=0.5 else "c-warn")

def metric_chips(s):
    chips=[]
    if s.get("trig"):
        chips.append(f'<span class="mchip {trig_cls(s["trig"].get("acc"))}"><span class="ic">\U0001F3AF</span><span class="lab">trig</span>{esc(s["trig"]["score"])}</span>')
    if s.get("effect"):
        qi=s["effect"]["qi"]; chips.append(f'<span class="mchip {eff_cls(qi)}"><span class="ic">⚡</span><span class="lab">effect</span>{("+" if qi>=0 else "")+format(qi,".2f")}</span>')
    if s.get("security"):
        sec=s["security"]; cls="c-good" if sec["passed"]==sec["total"] else "c-warn"
        chips.append(f'<span class="mchip {cls}"><span class="ic">\U0001F6E1</span><span class="lab">scan</span>{sec["passed"]}/{sec["total"]}</span>')
    return f'<div class="metrics">{"".join(chips)}</div>' if chips else ""

def kb(n): return f"{n} B" if n<1024 else f"{n/1024:.1f} KB"

# ---------- shared <head> ----------
def head(title, rel=""):
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="{rel}assets/base.css">
</head><body>
<canvas id="dots" aria-hidden="true"></canvas>"""

FOOT = f"""<script src="__REL__assets/dots.js"></script>"""

# ---------- featured cards (server-rendered) ----------
def hero_card(s):
    ident = s["id"]
    if ident == "cicero":
        c = CURATED["cicero"]
        return f"""<a class="hero-card" style="--dc:var(--t-git)" href="skill/cicero.html">
  <div class="hero-glyph">✎</div>
  <div class="hero-id">cicero</div>
  <div class="hero-tag">{esc(TAGLINE['cicero'])}</div>
  <div class="hero-foot"><span class="hero-kind">{esc(c['kind'])}</span><span class="hero-go">explore →</span></div>
</a>"""
    return f"""<a class="hero-card" style="--dc:var(--dc-{esc(s['plugin'])})" href="skill/{esc(s['slug'])}.html">
  <div class="hero-glyph">◉</div>
  <div class="hero-id"><span class="ns">{esc(s['id'].split(':')[0])}:</span>{esc(s['id'].split(':')[1])}</div>
  <div class="hero-tag">{esc(TAGLINE.get(s['id'], s['purpose']))}</div>
  <div class="hero-foot">{metric_chips(s)}<span class="hero-go">explore →</span></div>
</a>"""

def flagship_card(s):
    ns, nm = s["id"].split(":",1)
    return f"""<a class="flag-card" style="--dc:var(--dc-{esc(s['plugin'])})" href="skill/{esc(s['slug'])}.html">
  <div class="flag-id"><span class="ns">{esc(ns)}:</span>{esc(nm)}</div>
  <div class="flag-tag">{esc(TAGLINE.get(s['id'], s['purpose']))}</div>
  <div class="flag-foot">{metric_chips(s)}</div>
</a>"""

# ---------- per-skill page ----------
def measure_block(s):
    if not s.get("trig"): return ""
    t=s["trig"]; pct=f"{round(t['acc']*100)}%" if t.get("acc") is not None else "—"
    base=f"{round(t['baseline']*100)}%" if t.get("baseline") is not None else "—"
    return f"""<section class="p-sec"><h3>measured · trigger</h3><div class="measure">
    <div class="mcell"><div class="k">best score</div><div class="v {trig_cls(t.get('acc'))}">{esc(t['score'])}</div><small>description-triggering</small></div>
    <div class="mcell"><div class="k">accuracy</div><div class="v">{pct}</div><small>vs baseline {base}</small></div>
    <div class="mcell"><div class="k">runs/query</div><div class="v">{esc(t.get('runs') or '—')}</div><small>model {esc(t.get('model') or '—')}</small></div>
  </div><div class="bmeta">measured {esc((t.get('at') or '')[:10])}</div></section>"""

def effect_block(s):
    if not s.get("effect"): return ""
    e=s["effect"]; qi=e["qi"]
    ss=f"{e['skillscore']:.2f}" if e.get("skillscore") is not None else "—"
    verdict=f'<div class="when" style="margin-top:.6rem">{esc(e["verdict"])}</div>' if e.get("verdict") else ""
    return f"""<section class="p-sec"><h3>measured · effect (skillaxe)</h3><div class="measure">
    <div class="mcell"><div class="k">quality impact</div><div class="v {eff_cls(qi)}">{('+' if qi>=0 else '')+format(qi,'.2f')}</div><small>d·m, −1…1</small></div>
    <div class="mcell"><div class="k">skillscore</div><div class="v">{ss}</div><small>rubric adherence 0–1</small></div>
    <div class="mcell"><div class="k">guide faults</div><div class="v {'c-good' if not e['faults'] else ''}">{len(e['faults']) or '0'}</div><small>fixable in the guide</small></div>
  </div>{verdict}<div class="bmeta">measured {esc((e.get('at') or '')[:10])} · model {esc(e.get('model') or '—')}</div></section>"""

def scan_block(s):
    if not s.get("security"): return ""
    sec=s["security"]; rows=[]
    for c in sec["checklist"]:
        v=c.get("verdict"); st="flag" if v=="flag" else ("na" if v=="n/a" else "pass")
        glyph="▲" if v=="flag" else ("–" if v=="n/a" else "✓")
        rows.append(f'<div class="row"><span class="st {st}">{glyph}</span><span class="nm">{esc(c.get("point"))}</span><span class="dt">{esc(c.get("note"))}</span></div>')
    return f"""<section class="p-sec"><h3>security scan · {sec['passed']}/{sec['total']}</h3><div class="scan">{''.join(rows)}</div>
    <div class="bmeta">scanned {esc((sec.get('at') or '')[:10])} · cerberus:security-scan</div></section>"""

def tree_block(s):
    rows=[]
    for f in s["tree"]:
        parts=f["path"].split("/"); name=parts.pop(); lead=("/".join(parts)+"/") if parts else ""
        md=" md" if f["path"]=="SKILL.md" else ""
        rows.append(f'<div class="f{md}"><span><span class="lead">{esc(lead)}</span>{esc(name)}</span><span class="sz">{kb(f["bytes"])}</span></div>')
    return f'<div class="tree">{"".join(rows)}</div>'

def needs_block(s):
    if not s["needs"]:
        return '<span class="when" style="border:none;padding:0">nothing</span>'
    out=[]
    for n in s["needs"]:
        folder=n.split(":",1)[1] if ":" in n else n; plugin=n.split(":",1)[0] if ":" in n else ""
        slug=f"{plugin}__{folder}" if plugin else n
        out.append(f'<a class="dep" href="{esc(slug)}.html">{esc(n)}</a>')
    return "".join(out)

def skill_page(s):
    ns, nm = s["id"].split(":",1)
    src=f"{REPO}/tree/main/plugins/{ns}/skills/{nm}"
    md=f"{REPO}/blob/main/plugins/{ns}/skills/{nm}/SKILL.md"
    body=head(f"{s['id']} · Skill Marketplace", rel="../")
    body+=f"""
<div class="page" style="--dc:var(--dc-{esc(s['plugin'])})">
  <a class="back" href="../index.html">← all skills</a>
  <header class="p-head">
    <div class="p-badge">{esc(s['plugin'])}</div>
    <h1 class="p-id"><span class="ns">{esc(ns)}:</span>{esc(nm)} <span class="p-ver">v{esc(s['version'])}</span></h1>
    <p class="p-purpose">{esc(s['purpose'])}</p>
    {metric_chips(s)}
    <div class="p-install"><b>install</b> <code>/plugin install {esc(ns)}@{MARKET}</code></div>
    <div class="srcrow"><a class="srclink" href="{src}" target="_blank" rel="noopener">↗ source on GitHub</a>
      <a class="srclink ghost" href="{md}" target="_blank" rel="noopener">SKILL.md</a></div>
  </header>
  <div class="p-body">
    <section class="p-sec"><h3>fires when</h3><div class="when">{esc(s['activates'])}</div></section>
    {f'<section class="p-sec"><h3>best for</h3><div class="when">{esc(s["best"])}</div></section>' if s['best'] else ''}
    {measure_block(s)}
    {effect_block(s)}
    {scan_block(s)}
    <section class="p-sec"><h3>side effects &amp; deps</h3>
      <div class="kv" style="margin-bottom:.5rem">{tag_badges(s['tags'])}{'<span class="badge b-ro">hook</span>' if s['hooks'] else ''}</div>
      <div class="kv"><span class="lab">needs</span>{needs_block(s)}</div></section>
    <section class="p-sec"><h3>what’s inside</h3>{tree_block(s)}</section>
    <section class="p-sec"><h3>SKILL.md</h3><div class="when">Full instructions live in the repo — <a href="{md}" target="_blank" rel="noopener">read SKILL.md on GitHub ↗</a> · {len(s['tree'])} files in the bundle.</div></section>
  </div>
</div>
{FOOT.replace('__REL__','../')}
</body></html>"""
    return body

def cicero_page():
    c=CURATED["cicero"]
    src=f"{REPO}/tree/main/plugins/cicero"
    style=f"{REPO}/blob/main/plugins/cicero/output-styles/cicero.md"
    body=head("cicero · Skill Marketplace", rel="../")
    body+=f"""
<div class="page" style="--dc:var(--t-git)">
  <a class="back" href="../index.html">← all skills</a>
  <header class="p-head">
    <div class="p-badge">cicero</div>
    <h1 class="p-id">cicero <span class="p-ver">v2.4.2</span></h1>
    <p class="p-purpose">{esc(TAGLINE['cicero'])}</p>
    <div class="p-install"><b>install</b> <code>/plugin install cicero@{MARKET}</code></div>
    <div class="srcrow"><a class="srclink" href="{src}" target="_blank" rel="noopener">↗ source on GitHub</a>
      <a class="srclink ghost" href="{style}" target="_blank" rel="noopener">output-style</a></div>
  </header>
  <div class="p-body">
    <section class="p-sec"><h3>what it is</h3><div class="when">Not a skill you invoke — an <b>output style</b> applied at the system-prompt level, plus a SessionStart hook that shows a banner and picks the conversation language. It governs how every reply is shaped: result first, plain words, one recommended option, push back with reasons, honesty about verification, stay in scope.</div></section>
    <section class="p-sec"><h3>the floor</h3><div class="when">Four rules are invariants that hold even when a user asks otherwise: honesty about verification (and never ending a turn on a promise), no flattery, own a mistake once and hold the position under pressure, and push back before acting. Every other rule is a user-overridable default.</div></section>
    <section class="p-sec"><h3>ships as</h3><div class="kv"><span class="lab">kind</span><code>output-style + hooks</code></div></section>
  </div>
</div>
{FOOT.replace('__REL__','../')}
</body></html>"""
    return body

# ---------- index ----------
def index_page(skills, doms, pal):
    by_id={s["id"]:s for s in skills}
    heroes=[]
    for hid in HERO_IDS:
        if hid=="cicero": heroes.append(hero_card({"id":"cicero"}))
        elif hid in by_id: heroes.append(hero_card(by_id[hid]))
    flags=[flagship_card(by_id[i]) for i in FLAGSHIP_IDS if i in by_id]
    featured_ids={i for i in HERO_IDS+FLAGSHIP_IDS if i in by_id}
    # client data: everything the grid needs
    gdata=[{"id":s["id"],"plugin":s["plugin"],"slug":s["slug"],"version":s["version"],
            "purpose":s["purpose"],"activates":s["activates"],"best":s["best"],
            "needs":s["needs"],"tags":s["tags"],
            "trig":(s["trig"]["score"] if s["trig"] else None),"trigAcc":(s["trig"]["acc"] if s["trig"] else None),
            "effect":(s["effect"]["qi"] if s["effect"] else None),
            "sec":([s["security"]["passed"],s["security"]["total"]] if s["security"] else None)} for s in skills]
    payload=json.dumps({"skills":gdata,"palette":pal,"domains":doms}, ensure_ascii=False).replace("</script>","<\\/script>")
    h=head("Skill Marketplace", rel="")
    h+=f"""
<div class="wrap">
  <header class="top">
    <div class="brand"><h1>Skill Marketplace<span class="d">.</span></h1>
      <span class="counts"><b id="total">{len(skills)}</b> skills · <b id="doms">{len(doms)}</b> domains</span></div>
    <p class="lede">A curated marketplace of Claude Code skills — each one shows what it does, when it fires, what it touches, and its measured trigger, effect and safety.</p>
  </header>

  <section class="featured">
    <div class="sect-label">headliners</div>
    <div class="hero-duo">{''.join(heroes)}</div>
    <div class="flag-row">{''.join(flags)}</div>
  </section>

  <section class="browse">
    <div class="sect-label">all skills</div>
    <input class="search" id="q" type="search" placeholder="Search id, purpose, or trigger…" autocomplete="off">
    <div class="filters" id="df"><span class="flabel">domain</span></div>
    <div class="grid" id="grid"></div>
    <div class="empty" id="empty" hidden>no skills match</div>
  </section>

  <footer>Generated from <code>catalog.json</code> by <code>scripts/gen_showcase.py</code> — one source, no hand-maintained list.
  Each page shows what a skill does, when it fires, what it touches, and links to its <code>SKILL.md</code> on GitHub.</footer>
</div>
"""
    h+='<script id="data" type="application/json">'+payload+'</script>\n'
    h+="<script>\n"+INDEX_JS+"\n</script>\n"
    h+=FOOT.replace('__REL__','')+"\n</body></html>"
    return h

INDEX_JS = r"""
const D=JSON.parse(document.getElementById('data').textContent);
const PAL=D.palette, SK=D.skills, DOMS=D.domains;
const esc=s=>(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const st={q:'',dom:null};
document.getElementById('doms').textContent=DOMS.length;
const df=document.getElementById('df');
DOMS.forEach(d=>{const n=SK.filter(s=>s.plugin===d).length;const b=document.createElement('button');
  b.className='chip';b.setAttribute('aria-pressed','false');b.dataset.dom=d;b.innerHTML=`${d} <span class="n">${n}</span>`;
  b.onclick=()=>{st.dom=st.dom===d?null:d;sync();render();};df.appendChild(b);});
function sync(){df.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.dom===st.dom));}
document.getElementById('q').addEventListener('input',e=>{st.q=e.target.value.toLowerCase().trim();render();});
function tagB(t){return t.length?t.map(x=>`<span class="badge b-${x}">${x}</span>`).join(''):'<span class="badge b-ro">read-only</span>';}
function trigCls(a){return a==null?'c-none':(a>=0.7?'c-good':'c-warn');}
function effCls(q){return q==null?'c-none':(q>=0.5?'c-good':'c-warn');}
function chips(s){const c=[];
  if(s.trig!=null)c.push(`<span class="mchip ${trigCls(s.trigAcc)}"><span class="ic">\u{1F3AF}</span><span class="lab">trig</span>${esc(s.trig)}</span>`);
  if(s.effect!=null)c.push(`<span class="mchip ${effCls(s.effect)}"><span class="ic">⚡</span><span class="lab">effect</span>${(s.effect>=0?'+':'')+s.effect.toFixed(2)}</span>`);
  if(s.sec)c.push(`<span class="mchip ${s.sec[0]===s.sec[1]?'c-good':'c-warn'}"><span class="ic">\u{1F6E1}</span><span class="lab">scan</span>${s.sec[0]}/${s.sec[1]}</span>`);
  return c.length?`<div class="metrics">${c.join('')}</div>`:'';}
function match(s){if(st.dom&&s.plugin!==st.dom)return false;
  if(st.q){const h=(s.id+' '+s.purpose+' '+s.activates+' '+s.best).toLowerCase();if(!h.includes(st.q))return false;}return true;}
function card(s){const[ns,nm]=s.id.split(':');const a=document.createElement('a');a.className='card';a.href='skill/'+s.slug+'.html';
  a.style.setProperty('--dc',PAL[s.plugin]);
  a.innerHTML=`<div class="head"><span class="id"><span class="ns">${ns}:</span>${nm||''}</span><span class="ver">v${s.version}</span></div>
    <div class="body"><div class="purpose">${esc(s.purpose)}</div>${chips(s)}
    <div class="meta">${tagB(s.tags)}<span class="sep"></span>${s.needs.length?`<span class="needs"><b>needs</b> ${s.needs.length}</span>`:''}</div></div>`;
  return a;}
function render(){const sh=SK.filter(match);const g=document.getElementById('grid');g.innerHTML='';sh.forEach(s=>g.appendChild(card(s)));
  document.getElementById('empty').hidden=sh.length>0;}
render();
"""

# ---------- build ----------
def build():
    skills=load()
    doms=sorted({s["plugin"] for s in skills})
    pal=palette(doms)
    os.makedirs(os.path.join(OUTDIR,"skill"), exist_ok=True)
    os.makedirs(os.path.join(OUTDIR,"assets"), exist_ok=True)
    # domain palette as CSS vars for server-rendered cards
    dcvars="".join(f"--dc-{d}:{pal[d]};" for d in doms)
    open(os.path.join(OUTDIR,"assets","base.css"),"w").write(BASE_CSS.replace("__DCVARS__",dcvars))
    open(os.path.join(OUTDIR,"assets","dots.js"),"w").write(DOTS_JS)
    open(os.path.join(OUTDIR,"index.html"),"w").write(index_page(skills,doms,pal))
    for s in skills:
        open(os.path.join(OUTDIR,"skill",f"{s['slug']}.html"),"w").write(skill_page(s))
    open(os.path.join(OUTDIR,"skill","cicero.html"),"w").write(cicero_page())
    print(f"gen_showcase: wrote index + {len(skills)} skill pages + cicero, {len(doms)} domains -> showcase/")

# ---------- assets ----------
BASE_CSS = r"""
:root{--bg:#eceef3;--panel:#fff;--ink:#0f1420;--muted:#4b5568;--faint:#8790a1;--line:#e7eaf1;--line-2:#d7dce6;--accent:#4353d0;--hd:#6d28d9;--dot:20,28,45;
--t-files:#2f6fb0;--t-files-bg:#eaf2fa;--t-network:#9a6512;--t-network-bg:#f8efdb;--t-git:#7b48c0;--t-git-bg:#f1ebfb;--t-org:#1f7a6b;--t-org-bg:#e2f2ee;--t-money:#b23b3b;--t-money-bg:#f9e6e6;
--good:#1f8a54;--good-bg:#dcf0e5;--warn:#9a6a14;--warn-bg:#f7ecd6;--none:#8790a1;--none-bg:#e9ebf1;--shadow:0 1px 2px rgba(15,20,32,.05),0 6px 18px rgba(15,20,32,.07);__DCVARS__}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0c0f15;--panel:#161a22;--ink:#f6f8fc;--muted:#c6cedd;--faint:#8b95a6;--line:#242a34;--line-2:#353d4a;--accent:#97a7ff;--hd:#c3a6f7;--dot:150,170,220;
--t-files:#7fb2e0;--t-files-bg:#18293c;--t-network:#e0b566;--t-network-bg:#352a18;--t-git:#bd97e8;--t-git-bg:#2a1c3d;--t-org:#68cdb8;--t-org-bg:#132e29;--t-money:#e88;--t-money-bg:#331b1b;
--good:#5fce8c;--good-bg:#153023;--warn:#e6b65c;--warn-bg:#332915;--none:#7b8496;--none-bg:#20252e;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 22px rgba(0,0,0,.5);}}
[data-theme=dark]{--bg:#0c0f15;--panel:#161a22;--ink:#f6f8fc;--muted:#c6cedd;--faint:#8b95a6;--line:#242a34;--line-2:#353d4a;--accent:#97a7ff;--hd:#c3a6f7;--dot:150,170,220;
--t-files:#7fb2e0;--t-files-bg:#18293c;--t-network:#e0b566;--t-network-bg:#352a18;--t-git:#bd97e8;--t-git-bg:#2a1c3d;--t-org:#68cdb8;--t-org-bg:#132e29;--t-money:#e88;--t-money-bg:#331b1b;
--good:#5fce8c;--good-bg:#153023;--warn:#e6b65c;--warn-bg:#332915;--none:#7b8496;--none-bg:#20252e;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 22px rgba(0,0,0,.5);}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
#dots{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block}
.wrap,.page{position:relative;z-index:1;max-width:80rem;margin:0 auto;padding:0 clamp(1rem,4vw,2.5rem)}
a{color:var(--accent);text-decoration:none}
/* header */
.top{padding:clamp(2rem,7vh,4.5rem) 0 1.6rem}
.brand{display:flex;align-items:baseline;gap:.9rem;flex-wrap:wrap}
h1{font-size:clamp(1.7rem,4vw,2.4rem);font-weight:800;margin:0;letter-spacing:-.02em}h1 .d{color:var(--accent)}
.counts{font-family:"JetBrains Mono",monospace;font-size:.82rem;color:var(--muted)}.counts b{color:var(--ink);font-weight:600}
.lede{max-width:44rem;margin:.7rem 0 0;color:var(--muted);font-size:1.02rem}
.sect-label{font-family:"JetBrains Mono",monospace;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin:0 0 .8rem;display:flex;align-items:center;gap:.7rem}
.sect-label::after{content:"";flex:1;height:1px;background:var(--line-2)}
/* featured */
.featured{margin-bottom:2.6rem}
.hero-duo{display:grid;gap:1rem;grid-template-columns:1fr;margin-bottom:1rem}
@media(min-width:720px){.hero-duo{grid-template-columns:1fr 1fr}}
.hero-card{display:flex;flex-direction:column;gap:.7rem;min-height:12rem;padding:1.4rem 1.5rem;border-radius:1rem;
  background:linear-gradient(150deg,color-mix(in srgb,var(--dc) 16%,var(--panel)),var(--panel) 62%);
  border:1px solid var(--line-2);box-shadow:var(--shadow);overflow:hidden;position:relative;transition:transform .18s,box-shadow .18s}
.hero-card::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--dc)}
.hero-card:hover{transform:translateY(-3px);box-shadow:0 4px 10px rgba(20,28,45,.12),0 18px 40px rgba(20,28,45,.16)}
.hero-glyph{font-size:1.7rem;line-height:1;color:var(--dc)}
.hero-id{font-family:"JetBrains Mono",monospace;font-size:1.5rem;font-weight:600;color:var(--ink);letter-spacing:-.01em}
.hero-id .ns{color:var(--faint)}
.hero-tag{font-size:1rem;color:var(--muted);flex:1}
.hero-foot{display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap}
.hero-kind{font-family:"JetBrains Mono",monospace;font-size:.72rem;color:var(--faint)}
.hero-go{font-family:"JetBrains Mono",monospace;font-size:.8rem;font-weight:600;color:var(--dc);margin-left:auto}
.flag-row{display:grid;gap:.85rem;grid-template-columns:1fr}
@media(min-width:560px){.flag-row{grid-template-columns:1fr 1fr}}
@media(min-width:1024px){.flag-row{grid-template-columns:repeat(4,1fr)}}
.flag-card{display:flex;flex-direction:column;gap:.5rem;padding:1rem 1.1rem;border-radius:.8rem;background:var(--panel);
  border:1px solid var(--line-2);border-top:3px solid var(--dc);box-shadow:var(--shadow);transition:transform .16s,box-shadow .16s}
.flag-card:hover{transform:translateY(-2px);box-shadow:0 3px 8px rgba(20,28,45,.1),0 12px 28px rgba(20,28,45,.14)}
.flag-id{font-family:"JetBrains Mono",monospace;font-size:.95rem;font-weight:600;color:var(--ink);word-break:break-word}.flag-id .ns{color:var(--faint)}
.flag-tag{font-size:.85rem;color:var(--muted);flex:1}
.flag-foot .metrics{margin-top:.2rem}
/* browse */
.browse{margin-bottom:3rem}
.search{width:100%;font:inherit;font-size:.98rem;padding:.65rem .95rem;border-radius:.6rem;border:1px solid var(--line-2);background:color-mix(in srgb,var(--panel) 92%,transparent);color:var(--ink);margin-bottom:.7rem}
.search::placeholder{color:var(--faint)}.search:focus{outline:2px solid var(--accent);border-color:var(--accent)}
.filters{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;margin-bottom:1.1rem}
.flabel{font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-right:.2rem}
.chip{font:inherit;font-family:"JetBrains Mono",monospace;font-size:.74rem;padding:.24rem .6rem;border-radius:2rem;cursor:pointer;border:1px solid var(--line-2);background:var(--panel);color:var(--muted);white-space:nowrap}
.chip:hover{border-color:var(--accent);color:var(--ink)}.chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.chip .n{opacity:.6;font-size:.9em}
.grid{display:grid;gap:.85rem;grid-template-columns:1fr}
@media(min-width:640px){.grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.grid{grid-template-columns:repeat(3,1fr)}}
.card{background:var(--panel);border:1px solid var(--line-2);border-radius:.75rem;overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;color:inherit}
.card:hover{box-shadow:0 2px 5px rgba(20,28,45,.08),0 12px 30px rgba(20,28,45,.14);transform:translateY(-2px)}
.card{transition:transform .16s,box-shadow .16s}
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
.c-good{background:var(--good-bg);color:var(--good)}.c-warn{background:var(--warn-bg);color:var(--warn)}.c-none{background:var(--none-bg);color:var(--none)}
.empty{text-align:center;color:var(--faint);padding:3rem;font-family:"JetBrains Mono",monospace}
footer{margin:2rem 0 3rem;padding-top:1.2rem;border-top:1px solid var(--line);color:var(--faint);font-size:.78rem}
footer code{font-family:"JetBrains Mono",monospace;color:var(--muted)}
/* skill page */
.page{padding-top:1.6rem;padding-bottom:3rem}
.back{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:.8rem;color:var(--muted);margin:1rem 0 1.4rem}
.back:hover{color:var(--accent)}
.p-head{background:linear-gradient(150deg,color-mix(in srgb,var(--dc) 15%,var(--panel)),var(--panel) 60%);border:1px solid var(--line-2);border-left:4px solid var(--dc);border-radius:1rem;padding:1.5rem 1.7rem;box-shadow:var(--shadow);margin-bottom:1.6rem}
.p-badge{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:.66rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dc);background:color-mix(in srgb,var(--dc) 14%,transparent);padding:.2rem .55rem;border-radius:.4rem;margin-bottom:.7rem}
.p-id{font-family:"JetBrains Mono",monospace;font-size:clamp(1.3rem,3.6vw,1.9rem);font-weight:600;margin:0;letter-spacing:-.01em}.p-id .ns{color:var(--faint)}
.p-ver{font-size:.9rem;color:var(--faint);font-weight:500}
.p-purpose{font-size:1.05rem;color:var(--ink);margin:.6rem 0 .9rem;max-width:46rem}
.p-install{font-family:"JetBrains Mono",monospace;font-size:.82rem;color:var(--muted);margin:.9rem 0 .8rem}
.p-install code{background:var(--panel);border:1px solid var(--line-2);color:var(--accent);padding:.2rem .5rem;border-radius:.4rem}
.srcrow{display:flex;flex-wrap:wrap;gap:.5rem}
.srclink{display:inline-flex;align-items:center;gap:.4rem;font-family:"JetBrains Mono",monospace;font-size:.78rem;font-weight:600;color:#fff;background:var(--accent);padding:.5rem .8rem;border-radius:.5rem}
.srclink:hover{filter:brightness(1.08)}.srclink.ghost{color:var(--accent);background:transparent;border:1px solid var(--accent)}
.p-body{display:grid;gap:1.3rem}
.p-sec>h3{font-family:"JetBrains Mono",monospace;font-size:.72rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--hd);margin:0 0 .6rem;padding-bottom:.35rem;border-bottom:1px solid color-mix(in srgb,var(--hd) 30%,transparent)}
.when{font-size:.92rem;color:var(--ink);border-left:2px solid color-mix(in srgb,var(--hd) 45%,transparent);padding-left:.75rem}
.kv{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
.kv .lab{font-family:"JetBrains Mono",monospace;font-size:.64rem;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);margin-right:.2rem}
.dep{font-family:"JetBrains Mono",monospace;font-size:.74rem;background:var(--panel);border:1px solid var(--line-2);color:var(--accent);padding:.16rem .5rem;border-radius:.4rem}
.dep:hover{border-color:var(--accent)}
.measure{display:grid;grid-template-columns:repeat(auto-fill,minmax(8rem,1fr));gap:.5rem}
.mcell{border:1px solid var(--line);border-radius:.55rem;padding:.55rem .65rem;background:var(--panel)}
.mcell .k{font-family:"JetBrains Mono",monospace;font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;color:var(--faint)}
.mcell .v{font-family:"JetBrains Mono",monospace;font-size:1.1rem;font-weight:700;margin-top:.15rem;color:var(--ink)}
.mcell small{display:block;font-family:"JetBrains Mono",monospace;font-size:.6rem;color:var(--faint);margin-top:.2rem}
.bmeta{font-family:"JetBrains Mono",monospace;font-size:.68rem;color:var(--faint);margin-top:.5rem}
.scan{display:grid;gap:.3rem}
.scan .row{display:flex;align-items:center;gap:.5rem;font-size:.85rem;padding:.3rem .1rem;border-bottom:1px solid var(--line)}
.scan .row:last-child{border-bottom:none}
.scan .st{width:1.1rem;text-align:center;flex:none}.scan .pass{color:var(--good)}.scan .flag{color:var(--warn)}.scan .na{color:var(--none)}
.scan .nm{color:var(--ink)}.scan .dt{color:var(--muted);font-size:.78rem;margin-left:auto;text-align:right;max-width:62%}
.tree{font-family:"JetBrains Mono",monospace;font-size:.78rem;display:grid;gap:.15rem}
.tree .f{display:flex;gap:.5rem;color:var(--ink)}.tree .f .lead{color:var(--faint)}.tree .f .sz{margin-left:auto;color:var(--faint);font-size:.72rem}
.tree .f.md{font-weight:600}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-card,.flag-card,.card{transition:none}}
"""

DOTS_JS = r"""// Interactive point-field background. Theme-aware, reaches toward the cursor, honours reduced-motion.
(function(){
  const cv=document.getElementById('dots'); if(!cv) return;
  const ctx=cv.getContext('2d',{alpha:true});
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W=0,H=0,DPR=1,pts=[],raf=0;
  const mouse={x:-9999,y:-9999,on:false};
  function col(){ // read --dot "r,g,b" from the theme
    const v=getComputedStyle(document.documentElement).getPropertyValue('--dot').trim();
    return v||'20,28,45';
  }
  let RGB=col();
  function resize(){
    DPR=Math.min(2,window.devicePixelRatio||1);
    W=cv.clientWidth; H=cv.clientHeight;
    cv.width=Math.floor(W*DPR); cv.height=Math.floor(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    const target=Math.min(150,Math.round(W*H/12000));
    pts=[];
    for(let i=0;i<target;i++){
      const z=Math.random();               // depth 0(far)..1(near)
      pts.push({x:Math.random()*W,y:Math.random()*H,z,
        vx:(Math.random()-.5)*(.12+z*.22),vy:(Math.random()-.5)*(.12+z*.22)});
    }
  }
  function step(){
    ctx.clearRect(0,0,W,H);
    const near=150, near2=near*near;
    for(const p of pts){
      // ambient drift
      p.x+=p.vx; p.y+=p.vy;
      // reach toward the cursor when close
      if(mouse.on){
        const dx=mouse.x-p.x, dy=mouse.y-p.y, d2=dx*dx+dy*dy;
        if(d2<near2 && d2>1){ const f=(1-d2/near2)*0.06*(0.5+p.z); p.x+=dx*f; p.y+=dy*f; }
      }
      // wrap
      if(p.x<-10)p.x=W+10; if(p.x>W+10)p.x=-10; if(p.y<-10)p.y=H+10; if(p.y>H+10)p.y=-10;
      const r=0.6+p.z*1.9, a=0.10+p.z*0.30;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,6.283); ctx.fillStyle='rgba('+RGB+','+a+')'; ctx.fill();
    }
    // constellation lines around the cursor
    if(mouse.on){
      for(let i=0;i<pts.length;i++){
        const a=pts[i]; const adx=a.x-mouse.x, ady=a.y-mouse.y; if(adx*adx+ady*ady>near2) continue;
        for(let j=i+1;j<pts.length;j++){
          const b=pts[j]; const dx=a.x-b.x, dy=a.y-b.y, d2=dx*dx+dy*dy;
          if(d2<near2){ const al=(1-d2/near2)*0.16;
            ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
            ctx.strokeStyle='rgba('+RGB+','+al+')'; ctx.lineWidth=0.6; ctx.stroke(); }
        }
      }
    }
    raf=requestAnimationFrame(step);
  }
  function stat(){ // static field for reduced-motion
    ctx.clearRect(0,0,W,H);
    for(const p of pts){ const r=0.6+p.z*1.9, a=0.10+p.z*0.30;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,6.283); ctx.fillStyle='rgba('+RGB+','+a+')'; ctx.fill(); }
  }
  window.addEventListener('resize',()=>{resize(); if(reduce)stat();});
  window.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.on=true;});
  window.addEventListener('mouseout',()=>{mouse.on=false;mouse.x=-9999;mouse.y=-9999;});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{RGB=col();});
  resize();
  if(reduce){ stat(); } else { raf=requestAnimationFrame(step); }
})();
"""

if __name__ == "__main__":
    build()
