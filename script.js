const db={
tables:[
{name:"profiles",position:{x:45,y:95},fields:[["id","uuid","PK",true],["full_name","text","",true],["email","text","U",false],["role","user_role","",true],["created_at","timestamptz","",false]]},
{name:"students",position:{x:430,y:95},fields:[["student_id","text","PK",true],["profile_id","uuid","FK",false],["first_name","text","",true],["middle_name","text","",false],["last_name","text","",true],["course","text","",false],["year_level","int","",false],["section","text","",false],["contact_number","text","",false],["created_at","timestamptz","",false]]},
{name:"fee_types",position:{x:835,y:95},fields:[["fee_type_id","bigint","PK",true],["fee_name","text","U",true],["description","text","",false],["created_at","timestamptz","",false]]},
{name:"student_fees",position:{x:45,y:485},fields:[["student_fee_id","bigint","PK",true],["student_id","text","FK",true],["fee_type_id","bigint","FK",true],["amount_due","decimal(12,2)","",true],["amount_paid","decimal(12,2)","",false],["due_date","date","",false],["created_at","timestamptz","",false]]},
{name:"payments",position:{x:430,y:485},fields:[["payment_id","bigint","PK",true],["receipt_number","text","U",true],["student_id","text","FK",true],["cashier_id","uuid","FK",false],["payment_method","payment_method","",true],["total_amount","decimal(12,2)","",true],["status","payment_status","",false],["payment_date","timestamptz","",false],["notes","text","",false]]},
{name:"payment_items",position:{x:835,y:485},fields:[["payment_item_id","bigint","PK",true],["payment_id","bigint","FK",true],["student_fee_id","bigint","FK",true],["amount_paid","decimal(12,2)","",true]]}
],
enums:[
{name:"user_role",values:["student","cashier","admin"]},
{name:"payment_method",values:["cash","gcash"]},
{name:"payment_status",values:["pending","successful","failed","cancelled"]}
],
relationships:[
["students","profile_id","profiles","id"],
["student_fees","student_id","students","student_id"],
["student_fees","fee_type_id","fee_types","fee_type_id"],
["payments","student_id","students","student_id"],
["payments","cashier_id","profiles","id"],
["payment_items","payment_id","payments","payment_id"],
["payment_items","student_fee_id","student_fees","student_fee_id"]
]};

const queries=[
["1. List all students","SELECT student_id, first_name, middle_name, last_name, course, year_level, section\nFROM students\nORDER BY last_name, first_name;","Returns the student directory ordered alphabetically."],
["2. Show student balances","SELECT s.student_id,\n       s.first_name || ' ' || s.last_name AS student_name,\n       COALESCE(SUM(sf.amount_due),0) AS total_due,\n       COALESCE(SUM(sf.amount_paid),0) AS total_paid,\n       COALESCE(SUM(sf.amount_due - sf.amount_paid),0) AS balance\nFROM students s\nLEFT JOIN student_fees sf ON sf.student_id = s.student_id\nGROUP BY s.student_id, s.first_name, s.last_name\nORDER BY student_name;","Calculates total fees, payments, and remaining balance per student."],
["3. View a student's fees","SELECT sf.student_fee_id, ft.fee_name,\n       sf.amount_due, sf.amount_paid,\n       sf.amount_due - sf.amount_paid AS balance,\n       sf.due_date\nFROM student_fees sf\nJOIN fee_types ft ON ft.fee_type_id = sf.fee_type_id\nWHERE sf.student_id = 'STU-001'\nORDER BY sf.due_date;","Displays the normalized fee records for one student."],
["4. Payment history","SELECT p.receipt_number,\n       p.payment_date, p.payment_method,\n       p.total_amount, p.status\nFROM payments p\nWHERE p.student_id = 'STU-001'\nORDER BY p.payment_date DESC;","Shows payment transactions for a selected student."],
["5. Payment receipt details","SELECT p.receipt_number, p.payment_date,\n       ft.fee_name, pi.amount_paid\nFROM payments p\nJOIN payment_items pi ON pi.payment_id = p.payment_id\nJOIN student_fees sf ON sf.student_fee_id = pi.student_fee_id\nJOIN fee_types ft ON ft.fee_type_id = sf.fee_type_id\nWHERE p.receipt_number = 'OR-0001';","Combines the payment header with its normalized line items and fee names."],
["6. Successful collections","SELECT DATE(payment_date) AS payment_day,\n       SUM(total_amount) AS total_collected\nFROM payments\nWHERE status = 'successful'\nGROUP BY DATE(payment_date)\nORDER BY payment_day DESC;","Produces daily successful collection totals."],
["7. Unpaid or partially paid fees","SELECT s.student_id,\n       s.first_name || ' ' || s.last_name AS student_name,\n       ft.fee_name,\n       sf.amount_due - sf.amount_paid AS balance\nFROM student_fees sf\nJOIN students s ON s.student_id = sf.student_id\nJOIN fee_types ft ON ft.fee_type_id = sf.fee_type_id\nWHERE sf.amount_due > sf.amount_paid\nORDER BY student_name, ft.fee_name;","Finds outstanding student fee balances."],
["8. Cashier payment report","SELECT p.cashier_id,\n       COUNT(*) AS payment_count,\n       SUM(p.total_amount) AS total_processed\nFROM payments p\nWHERE p.status = 'successful'\nGROUP BY p.cashier_id\nORDER BY total_processed DESC;","Summarizes successful transactions handled by each cashier."]
];

const diagram=document.getElementById("diagram"),tablesEl=document.getElementById("tables"),svg=document.getElementById("connections"),tableEls=new Map();
document.getElementById("entityCount").textContent=String(db.tables.length).padStart(2,"0");
document.getElementById("relationshipCount").textContent=String(db.relationships.length).padStart(2,"0");
document.getElementById("enumCount").textContent=String(db.enums.length).padStart(2,"0");

function badgeHTML(k){if(!k)return"<span></span>";return`<span class="badge ${k==="PK"?"pk":k==="FK"?"fk":"unique"}">${k}</span>`}
function renderTables(){
 tablesEl.innerHTML="";
 db.tables.forEach(t=>{
  const e=document.createElement("article");e.className="table-card";e.dataset.table=t.name;e.style.left=t.position.x+"px";e.style.top=t.position.y+"px";
  e.innerHTML=`<div class="table-head"><span class="entity-icon"></span><span class="table-name">${t.name}</span><span class="field-count">${t.fields.length}</span></div><div class="fields">${t.fields.map(([n,type,k,r])=>`<div class="field" data-field="${n}">${badgeHTML(k)}<span class="field-name">${n}${r?'<span class="required"> *</span>':""}</span><span class="field-type">${type}</span></div>`).join("")}</div>`;
  tablesEl.appendChild(e);tableEls.set(t.name,e);makeDraggable(e);
 });
}
function renderEnums(){document.querySelectorAll(".enum-card").forEach(x=>x.remove())}
function fieldCenter(tn,fn){
 const t=tableEls.get(tn),f=t?.querySelector(`[data-field="${fn}"]`);if(!t||!f)return null;
 const d=diagram.getBoundingClientRect(),r=f.getBoundingClientRect();
 return{x:r.left-d.left+r.width/2+diagram.scrollLeft,y:r.top-d.top+r.height/2+diagram.scrollTop}
}
function drawConnections(){
 const w=Math.max(diagram.scrollWidth,diagram.clientWidth),h=Math.max(diagram.scrollHeight,diagram.clientHeight);
 svg.setAttribute("viewBox",`0 0 ${w} ${h}`);svg.setAttribute("width",w);svg.setAttribute("height",h);
 svg.innerHTML=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#46e4dc"/></marker></defs>`;
 db.relationships.forEach(([a,af,b,bf])=>{
  const p=fieldCenter(a,af),q=fieldCenter(b,bf);if(!p||!q)return;
  const dx=Math.max(60,Math.abs(q.x-p.x)*.45),dir=q.x>=p.x?1:-1;
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("class","connection");path.setAttribute("marker-end","url(#arrow)");path.setAttribute("d",`M ${p.x} ${p.y} C ${p.x+dx*dir} ${p.y}, ${q.x-dx*dir} ${q.y}, ${q.x} ${q.y}`);svg.appendChild(path);
  const dot=document.createElementNS("http://www.w3.org/2000/svg","circle");dot.setAttribute("class","connection-dot");dot.setAttribute("cx",p.x);dot.setAttribute("cy",p.y);dot.setAttribute("r","3");svg.appendChild(dot);
 });
}
function makeDraggable(el){
 const h=el.querySelector(".table-head");let sx,sy,sl,st;
 h.addEventListener("pointerdown",ev=>{ev.preventDefault();h.setPointerCapture(ev.pointerId);el.classList.add("dragging");sx=ev.clientX;sy=ev.clientY;sl=parseFloat(el.style.left)||0;st=parseFloat(el.style.top)||0});
 h.addEventListener("pointermove",ev=>{if(!el.classList.contains("dragging"))return;el.style.left=Math.max(10,sl+ev.clientX-sx)+"px";el.style.top=Math.max(10,st+ev.clientY-sy)+"px";drawConnections()});
 h.addEventListener("pointerup",()=>el.classList.remove("dragging"));h.addEventListener("pointercancel",()=>el.classList.remove("dragging"));
}
document.getElementById("resetBtn").onclick=()=>{db.tables.forEach(t=>{const e=tableEls.get(t.name);e.style.left=t.position.x+"px";e.style.top=t.position.y+"px"});diagram.scrollLeft=0;diagram.scrollTop=0;drawConnections()};

document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>{
 document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));document.querySelectorAll(".page-section").forEach(s=>s.classList.remove("active-section"));
 btn.classList.add("active");document.getElementById(btn.dataset.target).classList.add("active-section");
 if(btn.dataset.target==="erd-section")requestAnimationFrame(drawConnections);
}));

const qlist=document.getElementById("queryList");
queries.forEach(([title,sql,desc],i)=>{
 const card=document.createElement("article");card.className="query-card";
 card.innerHTML=`<div class="query-head"><h3>${title}</h3><button class="copy-btn" data-query="${i}">Copy</button></div><div class="query-code"><pre><code>${escapeHTML(sql)}</code></pre></div><div class="query-desc">${desc}</div>`;
 qlist.appendChild(card);
});
function escapeHTML(s){return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
document.querySelectorAll(".copy-btn").forEach(btn=>btn.addEventListener("click",async()=>{
 const target=btn.dataset.copy?document.getElementById(btn.dataset.copy).innerText:queries[Number(btn.dataset.query)][1];
 try{await navigator.clipboard.writeText(target);const old=btn.textContent;btn.textContent="Copied!";setTimeout(()=>btn.textContent=old,1200)}catch(e){btn.textContent="Copy failed"}
}));

renderTables();
window.addEventListener("load",()=>requestAnimationFrame(drawConnections));
window.addEventListener("resize",drawConnections);
diagram.addEventListener("scroll",drawConnections);
