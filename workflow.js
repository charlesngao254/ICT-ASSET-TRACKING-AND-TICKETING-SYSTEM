const workflowStorageVersion = '2026.3';
const workflowDemoAccounts = [
  { id:'admin', name:'Department Administrator', email:'admin@justice.gov', unit:'Administration', role:'System Administrator', active:true },
  { id:'staff-legal', name:'Jordan Mwangi', email:'j.mwangi@justice.gov', unit:'Legal Services', role:'Staff', active:true },
  { id:'staff-human', name:'Mary Otieno', email:'m.otieno@justice.gov', unit:'Human Rights', role:'Staff', active:true },
  { id:'ps-main', name:'Patricia Wanjiku', email:'ps@justice.gov', unit:'Office of the PS', role:'Permanent Secretary', active:true },
  { id:'cfo-main', name:'David Kiptoo', email:'cfo@justice.gov', unit:'Finance', role:'CFO / Finance', active:true },
  { id:'accounts-main', name:'Sarah Kamau', email:'accounts@justice.gov', unit:'Accounts', role:'Accounts Keeper', active:true },
  { id:'hod-legal', name:'Anne Njoroge', email:'hod.legal@justice.gov', unit:'Legal Services', role:'HOD', active:true },
  { id:'hod-rights', name:'Eric Wambui', email:'hod.rights@justice.gov', unit:'Human Rights', role:'HOD', active:true },
  { id:'records-main', name:'Esther Wambui', email:'records@justice.gov', unit:'Records Office', role:'Records Officer', active:true },
  { id:'ict-main', name:'ICT Service Desk', email:'ict@justice.gov', unit:'ICT Directorate', role:'ICT Officer', active:true },
  { id:'fleet-main', name:'Noah Ouma', email:'fleet@justice.gov', unit:'Administration', role:'Fleet Officer', active:true }
];
const workflowStages = ['PS approval', 'CFO action', 'Accounts processing', 'Completed'];
const workflowStageRole = { 'PS approval':'Permanent Secretary', 'CFO action':'CFO / Finance', 'Accounts processing':'Accounts Keeper' };
const workflowRoles = ['Staff','HOD','Permanent Secretary','CFO / Finance','Accounts Keeper','Records Officer','ICT Officer','Fleet Officer','System Administrator'];

if (data.workflowVersion !== workflowStorageVersion) {
  if (!Array.isArray(data.accounts)) data.accounts = structuredClone(workflowDemoAccounts);
  if (!Array.isArray(data.memos)) data.memos = [
    { id:'MEM-2026-041', title:'Regional legal aid outreach programme', activity:'Legal aid clinics in Nakuru and Nyandarua counties', amount:485000, unit:'Legal Services', initiatorId:'staff-legal', initiatorName:'Jordan Mwangi', stage:'PS approval', shared:false, createdAt:'09 Nov 2026', participantIds:[], attachments:[], comments:[], history:[{stage:'Submitted for PS approval', actor:'Jordan Mwangi', date:'09 Nov 2026'}] },
    { id:'MEM-2026-040', title:'Community rights awareness workshops', activity:'Public education sessions across three sub-counties', amount:320000, unit:'Human Rights', initiatorId:'staff-human', initiatorName:'Mary Otieno', stage:'CFO action', shared:false, createdAt:'08 Nov 2026', participantIds:['ps-main'], attachments:[], comments:[], history:[{stage:'Submitted for PS approval', actor:'Mary Otieno', date:'08 Nov 2026'},{stage:'Forwarded to CFO / Finance', actor:'Patricia Wanjiku', date:'09 Nov 2026'}] },
    { id:'MEM-2026-039', title:'Constitutional review stakeholder forum', activity:'Stakeholder consultation forum and report', amount:275000, unit:'Constitutional Affairs', initiatorId:'staff-legal', initiatorName:'Jordan Mwangi', stage:'Accounts processing', shared:false, createdAt:'06 Nov 2026', participantIds:['ps-main','cfo-main'], attachments:[], comments:[], history:[{stage:'Submitted for PS approval', actor:'Jordan Mwangi', date:'06 Nov 2026'},{stage:'Forwarded to CFO / Finance', actor:'Patricia Wanjiku', date:'07 Nov 2026'},{stage:'Forwarded to Accounts Keeper', actor:'David Kiptoo', date:'08 Nov 2026'}] }
  ];
  if (!Array.isArray(data.tasks)) data.tasks = [
    { id:'TASK-021', title:'Review outreach venue quotations', detail:'Compare the three venue quotations and add a recommendation.', fromId:'hod-legal', toId:'staff-legal', unit:'Legal Services', due:'12 Nov 2026', status:'In progress', comments:[{authorId:'hod-legal', authorName:'Anne Njoroge', body:'Please check the accessibility and transport costs as well.', date:'09 Nov 2026'}] },
    { id:'TASK-020', title:'Prepare workshop attendance summary', detail:'Compile the signed attendance sheets for the recent workshops.', fromId:'hod-rights', toId:'staff-human', unit:'Human Rights', due:'13 Nov 2026', status:'Assigned', comments:[] }
  ];
  data.accounts.forEach(account => { if (account.active === undefined) account.active = account.status !== 'Pending approval'; });
  data.documents.forEach(doc => {
    if (!doc.ownerId) doc.ownerId = doc.owner === 'M. Otieno' ? 'staff-human' : doc.owner === 'A. Njoroge' ? 'hod-legal' : doc.owner === 'P. Wanjiku' ? 'ps-main' : doc.owner === 'S. Kamau' ? 'records-main' : 'staff-legal';
    if (doc.shared === undefined) doc.shared = doc.id === 'DOC-0079';
    if (!Array.isArray(doc.attachments)) doc.attachments = [];
    if (!Array.isArray(doc.comments)) doc.comments = [];
  });
  data.vehicles.forEach((vehicle,index) => {
    vehicle.mileageKm ??= [68420,42380,91750,35890][index] || 25000;
    vehicle.fuelLitresPer100Km ??= [12.4,10.8,9.6,7.2][index] || 8.5;
    vehicle.latitude ??= vehicle.status === 'On assignment' ? -0.3031 : -1.2864;
    vehicle.longitude ??= vehicle.status === 'On assignment' ? 36.0800 : 36.8172;
    vehicle.locationUpdatedAt ??= new Date().toISOString();
    vehicle.locationSource ??= 'Demo GPS';
    vehicle.speedKph ??= vehicle.status === 'On assignment' ? 46 : 0;
  });
  const demoTicketOwners = {'HD-1048':'staff-legal','HD-1047':'staff-human','HD-1046':'cfo-main','HD-1045':'records-main'};
  data.tickets.forEach(ticket => { ticket.requesterId ??= demoTicketOwners[ticket.id] || ''; });
  data.workflowVersion = workflowStorageVersion;
  save();
}

let currentUser = data.accounts.find(account => account.id === (sessionStorage.getItem('justice-ops-account')||localStorage.getItem('justice-ops-account'))) || null;
const authScreen = document.getElementById('authScreen');
const appShell = document.getElementById('appShell');
const workflowNavigation = [
  ['overview','Overview'], ['memos','Activity memos'], ['tasks','Delegated tasks'],
  ['documents','Document management'], ['inventory','ICT inventory'], ['tickets','Service desk'],
  ['fleet','Fleet management'], ['tracking','Tracking'], ['access','Account access']
];

function isAdmin() { return currentUser?.role === 'System Administrator'; }
function canOpenPage(page) {
  if (['overview','memos','documents','tasks'].includes(page)) return true;
  if (page === 'tickets') return true;
  if (page === 'access') return isAdmin();
  if (page === 'inventory') return isAdmin() || currentUser?.role === 'ICT Officer';
  if (['fleet','tracking'].includes(page)) return isAdmin() || ['Fleet Officer','Permanent Secretary'].includes(currentUser?.role);
  return false;
}
function stageIndex(stage) { return workflowStages.indexOf(stage); }
function canAccessMemo(memo) {
  if (!currentUser) return false;
  return memo.shared === true || memo.initiatorId === currentUser.id ||
    (memo.participantIds || []).includes(currentUser.id) || workflowStageRole[memo.stage] === currentUser.role;
}
function canAccessDocument(doc) {
  return Boolean(currentUser) && (currentUser.role === 'Records Officer' || doc.shared === true || doc.ownerId === currentUser.id);
}
function visibleMemos() { return data.memos.filter(canAccessMemo); }
function roleNav() { return workflowNavigation.filter(([page]) => canOpenPage(page)); }
function workflowDate() { return new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function money(value) { return new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(Number(value)||0); }
function roleAccount(role) { return data.accounts.find(account => account.active && account.role === role); }
function saveWorkflow() { save(); }

function renderSignIn(message='') {
  appShell.style.display = 'none';
  authScreen.style.display = 'block';
  const active = data.accounts.filter(account => account.active && account.role !== 'Pending approval');
  authScreen.innerHTML = `<div class="auth-layout"><section class="auth-form"><header class="auth-header"><div class="auth-mark"><img class="auth-seal" src="assets/kenya-coat-of-arms.png" alt="Coat of Arms of Kenya"><p>SDJHRCA <span>|</span><strong>ICT Department</strong></p></div><h1 class="auth-heading">Sign in to access the asset management system</h1></header><form id="demoLogin"><div class="auth-fields"><div class="auth-field"><label for="loginEmail">Email Address</label><input id="loginEmail" name="email" type="email" list="demoEmails" placeholder="e.g. admin@justice.gov" autocomplete="username" required><datalist id="demoEmails">${active.map(account=>`<option value="${esc(account.email)}">`).join('')}</datalist><p class="auth-description">Use your email to sign in.</p></div><div class="auth-field"><label for="loginPassword">Password</label><div class="auth-input-wrap"><input id="loginPassword" name="password" type="password" placeholder="Enter password" autocomplete="current-password" required><button class="auth-password-toggle" id="togglePassword" type="button" aria-label="Show password"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><p class="auth-description">Use the password associated with your account.</p></div></div><div class="auth-options"><label class="auth-remember"><input id="keepLoggedIn" type="checkbox" checked>Keep me logged in</label><button class="auth-link" id="forgotPassword" type="button">forgot password?</button></div><div class="auth-message" id="authMessage">${esc(message)}</div><button class="auth-submit" id="signInButton" type="submit" disabled>Sign In</button><p class="auth-access">Don't have an account yet? <button id="showRegistration" type="button">Request access</button></p><p class="auth-demo-note">Prototype sign-in only: passwords are not verified. Do not enter real credentials.</p></form></section></div><footer class="auth-footer">© 2026 SDJHRCA. ICT Asset Management System. All rights reserved.</footer>`;
  const form=authScreen.querySelector('#demoLogin');
  const email=authScreen.querySelector('#loginEmail');
  const password=authScreen.querySelector('#loginPassword');
  const signInButton=authScreen.querySelector('#signInButton');
  const updateSubmit=()=>{signInButton.disabled=!(email.value.trim()&&password.value);};
  form.addEventListener('input',updateSubmit);
  authScreen.querySelector('#demoLogin').addEventListener('submit',event=>{
    event.preventDefault();
    currentUser=data.accounts.find(account=>account.email.toLowerCase()===email.value.trim().toLowerCase()&&account.active);
    if(!currentUser){authScreen.querySelector('#authMessage').textContent='No approved account matches that email.';return;}
    sessionStorage.setItem('justice-ops-account',currentUser.id);
    if(authScreen.querySelector('#keepLoggedIn').checked)localStorage.setItem('justice-ops-account',currentUser.id);else localStorage.removeItem('justice-ops-account');
    currentPage='overview';render();
  });
  authScreen.querySelector('#togglePassword').addEventListener('click',event=>{
    const visible=password.type==='text';password.type=visible?'password':'text';event.currentTarget.setAttribute('aria-label',visible?'Show password':'Hide password');
  });
  authScreen.querySelector('#forgotPassword').addEventListener('click',()=>{authScreen.querySelector('#authMessage').textContent='Password recovery is not available in this prototype.';});
  authScreen.querySelector('#showRegistration').addEventListener('click',renderRegistration);
}
function renderRegistration() {
  authScreen.innerHTML = `<div class="auth-layout"><section class="auth-form"><header class="auth-header"><div class="auth-mark"><img class="auth-seal" src="assets/kenya-coat-of-arms.png" alt="Coat of Arms of Kenya"><p>SDJHRCA <span>|</span><strong>ICT Department</strong></p></div><h1 class="auth-heading">Request access to the asset management system</h1></header><p class="auth-description" style="margin-bottom:20px">Provide your department details. An administrator assigns your role after review.</p><div class="auth-message" id="registrationMessage"></div><form id="registrationForm"><div class="auth-fields"><div class="auth-field"><label for="regName">Full name</label><input id="regName" name="name" required maxlength="100"></div><div class="auth-field"><label for="regEmail">Email Address</label><input id="regEmail" name="email" type="email" required maxlength="150"></div><div class="auth-field"><label for="regUnit">Department unit</label><input id="regUnit" name="unit" required maxlength="100"></div><div class="auth-field"><label for="regRole">Requested role</label><select id="regRole" name="requestedRole">${workflowRoles.filter(role=>role!=='System Administrator').map(role=>`<option>${esc(role)}</option>`).join('')}</select></div></div><button class="auth-submit" style="margin-top:22px" type="submit">Request access</button></form><p class="auth-access"><button id="showLogin" type="button">Back to sign in</button></p><p class="auth-demo-note">Requests are stored only in this browser in this prototype.</p></section></div><footer class="auth-footer">© 2026 SDJHRCA. ICT Asset Management System. All rights reserved.</footer>`;
  authScreen.querySelector('#showLogin').addEventListener('click',()=>renderSignIn());
  authScreen.querySelector('#registrationForm').addEventListener('submit',event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());
    if(data.accounts.some(account=>account.email.toLowerCase()===values.email.toLowerCase())){authScreen.querySelector('#registrationMessage').textContent='An account request already exists for that email.';return;}
    data.accounts.push({id:`request-${Date.now()}`,name:values.name,email:values.email,unit:values.unit,requestedRole:values.requestedRole,role:'Pending approval',active:false,status:'Pending approval'});
    saveWorkflow();renderSignIn('Account request submitted for administrator approval.');
  });
}

function renderWorkflowNav() {
  const links=roleNav();
  document.getElementById('navigation').innerHTML=links.map(([id,label])=>`<button class="nav-item ${id===currentPage?'active':''}" data-nav="${id}"><span class="nav-icon">${svg(id==='memos'?'documents':id==='tasks'?'tickets':id==='access'?'overview':id)}${id==='memos'||id==='tasks'||id==='access'?'':''}</span>${label}</button>`).join('');
  document.getElementById('crumbPage').textContent=links.find(([id])=>id===currentPage)?.[1]||'Overview';
  document.getElementById('profileName').textContent=currentUser?.name||'';
  document.getElementById('profileRole').textContent=currentUser?.role||'';
  document.getElementById('profileAvatar').textContent=(currentUser?.name||'').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
}
function workflowHeader(title,sub,action='') {
  return `<div class="page-heading"><div><p class="eyebrow">Department workflow</p><h1>${esc(title)}</h1><p class="heading-sub">${esc(sub)}<span class="prototype-note">Demo data · local to this browser</span></p></div><div class="heading-actions">${action}</div></div>`;
}
function renderWorkflowOverview() {
  const memos=visibleMemos();
  const tasks=data.tasks.filter(task=>task.fromId===currentUser.id||task.toId===currentUser.id);
  const chartStages=[...workflowStages.slice(0,3),'Completed'];
  const counts=chartStages.map(stage=>memos.filter(memo=>memo.stage===stage).length);
  const max=Math.max(1,...counts);
  const countPending=memos.filter(memo=>memo.stage!=='Completed').length;
  const sharedDocs=data.documents.filter(doc=>canAccessDocument(doc)).length;
  const chart=chartStages.map((stage,index)=>`<div class="chart-row"><span class="chart-label">${esc(stage)}</span><div class="chart-track"><div class="chart-fill" style="width:${Math.max(counts[index]===0?0:5,counts[index]/max*100)}%"></div></div><span class="chart-count">${counts[index]}</span></div>`).join('');
  return `${workflowHeader('Good morning, '+currentUser.name.split(' ')[0],`${currentUser.role} · ${currentUser.unit}`,`<button class="button primary" data-action="new-memo">+ New activity memo</button>`)}
    <div class="metrics">${metric('Memos in your workspace',memos.length,'Only records you are allowed to see','documents','#fbe8ea','#b42332')}${metric('Awaiting workflow action',countPending,'PS → CFO → Accounts','tickets','#fbf0df','#a66725')}${metric('Accessible documents',sharedDocs,'Shared with you or owned by you','documents','#eaf1f7','#426d91')}${metric('Delegated tasks',tasks.length,'Assigned to or by you','overview','#f5ece2','#a66725')}</div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Activity memo pipeline</h2><p class="panel-caption">Live counts for records visible to your account</p></div><button class="text-link" data-nav="memos">Open memos &rarr;</button></div><div class="workflow-chart"><div class="chart-rows">${chart}</div></div></section>
    <section class="panel"><div class="panel-head"><div><h2 class="panel-title">My next actions</h2><p class="panel-caption">Private assignments and approvals</p></div></div><div class="activity-list">${tasks.slice(0,3).map(task=>`<div class="activity-item"><span class="activity-mark">${svg('tickets')}</span><div class="activity-copy"><strong>${esc(task.title)}</strong><div class="subtext">${task.toId===currentUser.id?'Assigned to you':'Assigned by you'} · ${badge(task.status)}</div></div><span class="activity-time">${esc(task.due)}</span></div>`).join('')||'<div class="empty-state">No delegated tasks.</div>'}</div></section></div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="panel-title">Recent activity memos</h2><p class="panel-caption">Initiated, shared, or assigned to your workflow role</p></div><button class="text-link" data-nav="memos">View all &rarr;</button></div><div class="table-wrap"><table><thead><tr><th>Memo</th><th>Initiator</th><th>Amount</th><th>Current stage</th><th>Status</th></tr></thead><tbody>${memos.slice(0,4).map(memo=>`<tr><td><button class="row-action" data-open-memo="${esc(memo.id)}">${esc(memo.id)} · ${esc(memo.title)}</button></td><td>${esc(memo.initiatorName)}</td><td>${money(memo.amount)}</td><td>${esc(memo.stage)}</td><td>${badge(memo.stage)}</td></tr>`).join('')||'<tr><td class="empty-state" colspan="5">No memos visible in this workspace.</td></tr>'}</tbody></table></div></section>`;
}
function renderMemoList() {
  const memos=visibleMemos().filter(matches);
  return `${workflowHeader('Activity memos','Initiators can track their own submissions; approvers see items at their stage.',`<button class="button primary" data-action="new-memo">+ New activity memo</button>`)}<section class="panel"><div class="page-toolbar"><div class="toolbar-left"><span class="subtext">${memos.length} visible records</span></div><div class="toolbar-right"><input class="inline-search" id="moduleSearch" type="search" placeholder="Search visible memos" value="${esc(searchQuery)}"></div></div><div class="table-wrap"><table class="module-table"><thead><tr><th>Memo / activity</th><th>Initiator</th><th>Unit</th><th>Amount</th><th>Workflow stage</th><th>Submitted</th><th></th></tr></thead><tbody>${memos.map(memo=>`<tr><td><strong>${esc(memo.title)}</strong><div class="subtext">${esc(memo.id)} · ${esc(memo.activity)}</div></td><td>${esc(memo.initiatorName)}</td><td>${esc(memo.unit)}</td><td>${money(memo.amount)}</td><td>${badge(memo.stage)}</td><td>${esc(memo.createdAt)}</td><td><button class="row-action" data-open-memo="${esc(memo.id)}">Open</button></td></tr>`).join('')||'<tr><td class="empty-state" colspan="7">No memos are visible to this account.</td></tr>'}</tbody></table></div></section>`;
}
function createMemo() {
  const fields=[['title','Memo title','text','e.g. Regional activity travel request'],['activity','Purpose and activity','textarea','Explain the activity requiring funds'],['amount','Estimated amount (KES)','number','0'],['unit','Department unit','select','Legal Services|Human Rights|Constitutional Affairs|Administration'],['shared','Share memo with everyone?','select','No, participants only|Yes, entire department']];
  openModal('Submit activity memo',fields,'memo','Submit to PS',values=>{
    const memo={id:`MEM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,title:values.title,activity:values.activity,amount:Number(values.amount),unit:values.unit,initiatorId:currentUser.id,initiatorName:currentUser.name,stage:'PS approval',shared:values.shared.startsWith('Yes'),createdAt:workflowDate(),participantIds:[],attachments:[],comments:[],history:[{stage:'Submitted for PS approval',actor:currentUser.name,date:workflowDate()}]};
    data.memos.unshift(memo);
  });
}
function workflowProgress(memo) {
  const active=stageIndex(memo.stage);
  return `<div class="stage-line">${workflowStages.map((stage,index)=>`<span class="stage-step ${memo.stage==='Completed'||index<active?'done':index===active?'current':''}">${index+1}. ${esc(stage)}</span>`).join('')}</div>`;
}
function memoCommentVisible(comment,memo) {
  return comment.authorId===currentUser.id || (memo.shared && comment.visibility==='everyone');
}
function openMemo(memoId) {
  const memo=data.memos.find(item=>item.id===memoId);
  if(!memo||!canAccessMemo(memo))return;
  const comments=(memo.comments||[]).filter(comment=>memoCommentVisible(comment,memo));
  const canAct=workflowStageRole[memo.stage]===currentUser.role;
  const isInitiator=memo.initiatorId===currentUser.id;
  const stageButtons=canAct?`<div class="memo-actions">${memo.stage==='PS approval'?'<button class="button primary" data-memo-transition="CFO action">Approve and forward to CFO</button>':''}${memo.stage==='CFO action'?'<button class="button primary" data-memo-transition="Accounts processing">Complete finance action; forward to Accounts</button>':''}${memo.stage==='Accounts processing'?'<button class="button primary" data-memo-transition="Completed">Mark accounts action complete</button>':''}<button class="button" data-memo-transition="Returned">Return to initiator</button></div>`:'';
  const resubmit=isInitiator&&memo.stage==='Returned'?'<button class="button primary" data-memo-transition="PS approval">Resubmit to PS</button>':'';
  const attachmentRows=(memo.attachments||[]).map((file,index)=>`<div class="attachment-row"><span>${esc(file.name)} <span class="subtext">${Math.ceil(file.size/1024)} KB</span></span><button class="row-action" data-preview-kind="memo" data-record-id="${esc(memo.id)}" data-file-index="${index}">Preview</button></div>`).join('')||'<p class="subtext">No attachments yet.</p>';
  const commentRows=comments.map(comment=>`<div class="comment-item"><div class="comment-meta"><span>${esc(comment.authorName)} · ${esc(comment.date)}</span><span>${comment.visibility==='everyone'?'Shared':'Only you'}</span></div>${esc(comment.body)}</div>`).join('')||'<p class="subtext">No comments visible to you.</p>';
  const root=document.getElementById('modalRoot');
  root.innerHTML=`<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><div class="modal-head"><div><h2 id="detailTitle">${esc(memo.title)}</h2><p class="panel-caption">${esc(memo.id)} · Initiated by ${esc(memo.initiatorName)}</p></div><button class="modal-close" aria-label="Close dialog">&times;</button></div><div class="modal-body"><div class="detail-block"><div class="stage-line" style="margin-bottom:10px">${workflowProgress(memo)}</div><div>${stageButtons}${resubmit}</div><div class="subtext" style="margin-top:10px">Current stage: ${esc(memo.stage)} · ${money(memo.amount)} · ${esc(memo.unit)}</div></div><div class="detail-grid"><div><div class="detail-block"><h3>Activity and purpose</h3><div style="font-size:11px;line-height:1.55">${esc(memo.activity)}</div></div><div class="detail-block"><h3>Attachments</h3>${attachmentRows}${isInitiator?'<label class="button" style="margin-top:8px;display:inline-flex">Attach file<input id="memoFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" hidden></label>':''}<p class="subtext" style="margin-top:8px">PDF, PNG, JPG or TXT · 500 KB per file in this demo.</p></div><div class="detail-block"><h3>Workflow history</h3>${memo.history.map(entry=>`<div class="comment-item"><div class="comment-meta"><span>${esc(entry.actor)}</span><span>${esc(entry.date)}</span></div>${esc(entry.stage)}</div>`).join('')}</div></div><div><div class="detail-block"><h3>Comments</h3><p class="private-note">Private comments are visible only to their author. Shared comments are visible to everyone only when the memo is shared.</p>${commentRows}<form id="memoCommentForm"><div class="field"><label for="memoComment">Add a comment</label><textarea id="memoComment" name="body" required maxlength="1500" placeholder="Write a comment"></textarea></div>${memo.shared?'<label class="field" style="display:flex;align-items:center;gap:7px;margin:9px 0"><input type="checkbox" name="everyone" value="yes"> Visible to everyone</label>':''}<button class="button" type="submit">Post comment</button></form></div></div></div></div></section></div>`;
  bindModalClose(root);
  root.querySelector('#memoCommentForm').addEventListener('submit',event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());memo.comments.push({authorId:currentUser.id,authorName:currentUser.name,body:values.body,visibility:values.everyone==='yes'?'everyone':'private',date:workflowDate()});saveWorkflow();openMemo(memo.id);
  });
  root.querySelector('[data-memo-transition]')?.closest('.detail-block')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-memo-transition]');if(!button)return;
    const next=button.dataset.memoTransition;
    if(next==='Returned'&&!window.confirm('Return this memo to its initiator?'))return;
    if(next!=='Returned'&&next!=='PS approval'&&workflowStageRole[memo.stage]!==currentUser.role)return;
    memo.stage=next;
    if(!memo.participantIds.includes(currentUser.id))memo.participantIds.push(currentUser.id);
    const actionText=next==='Returned'?'Returned to initiator':next==='PS approval'?'Resubmitted for PS approval':`Forwarded to ${next}`;
    memo.history.push({stage:actionText,actor:currentUser.name,date:workflowDate()});saveWorkflow();render();openMemo(memo.id);
  });
  root.querySelector('#memoFile')?.addEventListener('change',event=>addAttachment(memo,'memo',event.target.files?.[0]));
  bindPreviewButtons(root);
}

function renderDocumentPage() {
  const docs=data.documents.filter(doc=>canAccessDocument(doc)&&matches(doc));
  return `${workflowHeader('Document management','Private records stay with their owner and records administrators; shared records are visible to the department.',`<button class="button primary" data-action="new-document">+ Register document</button>`)}<section class="panel"><div class="page-toolbar"><div class="toolbar-left"><span class="subtext">${docs.length} documents visible</span></div><div class="toolbar-right"><input class="inline-search" id="moduleSearch" type="search" placeholder="Search visible documents" value="${esc(searchQuery)}"></div></div><div class="table-wrap"><table class="module-table"><thead><tr><th>Document</th><th>Type</th><th>Owner</th><th>Date</th><th>Sharing</th><th>Status</th><th></th></tr></thead><tbody>${docs.map(doc=>`<tr><td><strong>${esc(doc.title)}</strong><div class="subtext">${esc(doc.id)} · ${esc(doc.unit)}</div></td><td>${esc(doc.type)}</td><td>${esc(doc.owner)}</td><td>${esc(doc.date)}</td><td>${doc.shared?badge('Shared with everyone'):badge('Private')}</td><td>${badge(doc.status)}</td><td><button class="row-action" data-open-document="${esc(doc.id)}">Open</button></td></tr>`).join('')||'<tr><td class="empty-state" colspan="7">No documents are visible to this account.</td></tr>'}</tbody></table></div></section>`;
}
function createDocument() {
  const fields=[['title','Document title','text','Document name'],['type','Document type','select','Policy|Report|Minutes|Schedule|Correspondence|Other'],['unit','Department unit','select',`${currentUser.unit}|Legal Services|Human Rights|Constitutional Affairs|Administration`],['owner','Document owner','text',currentUser.name],['date','Received date','date',''],['shared','Share with everyone?','select','No, private|Yes, entire department']];
  openModal('Register document',fields,'document','Register document',values=>{
    data.documents.unshift({id:`DOC-${String(Date.now()).slice(-6)}`,title:values.title,type:values.type,unit:values.unit,owner:values.owner,ownerId:currentUser.id,date:values.date,status:'Draft',shared:values.shared.startsWith('Yes'),attachments:[],comments:[]});
  });
}
function openDocument(docId) {
  const doc=data.documents.find(item=>item.id===docId);if(!doc||!canAccessDocument(doc))return;
  const visibleComments=(doc.comments||[]).filter(comment=>comment.authorId===currentUser.id||(doc.shared&&comment.visibility==='everyone'));
  const attachments=(doc.attachments||[]).map((file,index)=>`<div class="attachment-row"><span>${esc(file.name)} <span class="subtext">${Math.ceil(file.size/1024)} KB</span></span><button class="row-action" data-preview-kind="document" data-record-id="${esc(doc.id)}" data-file-index="${index}">Preview</button></div>`).join('')||'<p class="subtext">No attachments yet.</p>';
  const comments=visibleComments.map(comment=>`<div class="comment-item"><div class="comment-meta"><span>${esc(comment.authorName)} · ${esc(comment.date)}</span><span>${comment.visibility==='everyone'?'Shared':'Only you'}</span></div>${esc(comment.body)}</div>`).join('')||'<p class="subtext">No comments visible to you.</p>';
  const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><div class="modal-head"><div><h2 id="detailTitle">${esc(doc.title)}</h2><p class="panel-caption">${esc(doc.id)} · ${doc.shared?'Shared with everyone':'Private document'}</p></div><button class="modal-close" aria-label="Close dialog">&times;</button></div><div class="modal-body"><div class="detail-grid"><div class="detail-block"><h3>Document details</h3><p class="subtext">${esc(doc.type)} · ${esc(doc.unit)} · ${esc(doc.date)}</p><p style="font-size:11px">Owner: ${esc(doc.owner)}</p><h3>Attachments</h3>${attachments}<label class="button" style="margin-top:8px;display:inline-flex">Attach file<input id="documentFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" hidden></label><p class="subtext" style="margin-top:8px">PDF, PNG, JPG or TXT · preview opens here without downloading.</p></div><div class="detail-block"><h3>Comments</h3><p class="private-note">Comments are private to their author unless explicitly shared on a document shared with everyone.</p>${comments}<form id="documentCommentForm"><div class="field"><label for="documentComment">Add a comment</label><textarea id="documentComment" name="body" required maxlength="1500"></textarea></div>${doc.shared?'<label class="field" style="display:flex;align-items:center;gap:7px;margin:9px 0"><input type="checkbox" name="everyone" value="yes"> Visible to everyone</label>':''}<button class="button" type="submit">Post comment</button></form></div></div></div></section></div>`;
  bindModalClose(root);
  root.querySelector('#documentCommentForm').addEventListener('submit',event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());doc.comments.push({authorId:currentUser.id,authorName:currentUser.name,body:values.body,visibility:values.everyone==='yes'?'everyone':'private',date:workflowDate()});saveWorkflow();openDocument(doc.id);});
  root.querySelector('#documentFile').addEventListener('change',event=>addAttachment(doc,'document',event.target.files?.[0]));bindPreviewButtons(root);
}

function canAccessTask(task) { return currentUser && (task.fromId===currentUser.id || task.toId===currentUser.id); }
function renderTasks() {
  const tasks=data.tasks.filter(canAccessTask).filter(matches);
  return `${workflowHeader('Delegated tasks','HOD assignments are private to the HOD and intended staff member.',currentUser.role==='HOD'?'<button class="button primary" data-action="delegate">+ Delegate a task</button>':'')}<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Tasks assigned to or by you</h2><p class="panel-caption">Private task list · not visible to department members</p></div></div><div class="tracking-list">${tasks.map(task=>`<article class="tracking-entry task-private"><span class="track-pin">${svg('tickets')}</span><div><div class="track-title">${esc(task.title)} ${badge(task.status)}</div><div class="track-meta">${esc(task.detail)}</div><div class="track-meta">${task.toId===currentUser.id?'Assigned to you':'Assigned by you'} · Due ${esc(task.due)}</div><button class="row-action" data-open-task="${esc(task.id)}">Open private task</button></div></article>`).join('')||'<div class="empty-state">No tasks assigned to or by this account.</div>'}</div></section>`;
}
function openDelegation() {
  const staff=data.accounts.filter(account=>account.active&&account.role==='Staff'&&account.unit===currentUser.unit);
  if(!staff.length){toast('No active staff accounts in your unit are available for assignment.');return;}
  const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="delegateTitle"><div class="modal-head"><h2 id="delegateTitle">Delegate a private task</h2><button class="modal-close" aria-label="Close dialog">&times;</button></div><form id="delegateForm" class="modal-body"><div class="form-grid"><div class="field full"><label for="delegateTitleInput">Task title</label><input id="delegateTitleInput" name="title" required maxlength="120"></div><div class="field full"><label for="delegateDetail">Instructions</label><textarea id="delegateDetail" name="detail" required maxlength="1000"></textarea></div><div class="field"><label for="delegateTo">Assign to</label><select id="delegateTo" name="toId">${staff.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></div><div class="field"><label for="delegateDue">Due date</label><input id="delegateDue" type="date" name="due" required></div></div><p class="private-note">Only you and the selected staff member can see this task and its comments.</p><div class="modal-actions"><button class="button" type="button" data-close>Cancel</button><button class="button primary" type="submit">Assign privately</button></div></form></section></div>`;
  bindModalClose(root);root.querySelector('#delegateForm').addEventListener('submit',event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());const target=data.accounts.find(person=>person.id===values.toId);data.tasks.unshift({id:`TASK-${String(Date.now()).slice(-5)}`,title:values.title,detail:values.detail,fromId:currentUser.id,toId:target.id,unit:currentUser.unit,due:values.due,status:'Assigned',comments:[]});saveWorkflow();root.innerHTML='';render();toast('Task assigned privately.');});
}
function openTask(taskId) {
  const task=data.tasks.find(item=>item.id===taskId);if(!task||!canAccessTask(task))return;
  const comments=(task.comments||[]).map(comment=>`<div class="comment-item"><div class="comment-meta"><span>${esc(comment.authorName)} · ${esc(comment.date)}</span></div>${esc(comment.body)}</div>`).join('')||'<p class="subtext">No private messages yet.</p>';
  const recipient=task.toId===currentUser.id;
  const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="taskTitle"><div class="modal-head"><div><h2 id="taskTitle">${esc(task.title)}</h2><p class="panel-caption">Private task · ${esc(task.unit)} · Due ${esc(task.due)}</p></div><button class="modal-close" aria-label="Close dialog">&times;</button></div><div class="modal-body"><div class="detail-block"><h3>Instructions</h3><p style="font-size:11px;line-height:1.6">${esc(task.detail)}</p><p>${badge(task.status)}</p>${recipient&&task.status!=='Completed'?'<button class="button primary" data-task-complete>Mark task complete</button>':''}</div><div class="detail-block"><h3>Private conversation</h3><p class="private-note">Visible only to the assigning HOD and intended staff member.</p>${comments}<form id="taskCommentForm"><div class="field"><label for="taskMessage">Reply</label><textarea id="taskMessage" name="body" required maxlength="1000"></textarea></div><button class="button" type="submit">Send private reply</button></form></div></div></section></div>`;
  bindModalClose(root);root.querySelector('#taskCommentForm').addEventListener('submit',event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());task.comments.push({authorId:currentUser.id,authorName:currentUser.name,body:values.body,date:workflowDate()});saveWorkflow();openTask(task.id);});root.querySelector('[data-task-complete]')?.addEventListener('click',()=>{task.status='Completed';saveWorkflow();render();openTask(task.id);});
}

function renderAccounts() {
  if(!isAdmin())return '<div class="empty-state">This area is restricted to system administrators.</div>';
  return `${workflowHeader('Account access','Approve account requests and assign an authorized role. Roles are granted by the administrator, not selected at sign-in.')}<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Department accounts</h2><p class="panel-caption">Account roles control which records and actions are presented in the workspace.</p></div></div><div class="account-row" style="font-weight:700;color:#78888a"><span>Account</span><span>Department unit</span><span>Current role</span><span>Access</span><span>Action</span></div>${data.accounts.map(account=>`<div class="account-row"><span><strong>${esc(account.name)}</strong><div class="subtext">${esc(account.email)}</div></span><span>${esc(account.unit)}</span><span>${account.active?`<span class="role-tag">${esc(account.role)}</span>`:`<select class="filter-select" data-account-role="${esc(account.id)}">${workflowRoles.filter(role=>role!=='System Administrator').map(role=>`<option ${role===account.requestedRole?'selected':''}>${esc(role)}</option>`).join('')}</select>`}</span><span>${account.active?badge('Active'):badge('Pending approval')}</span><span>${account.active?'<span class="subtext">Assigned</span>':`<button class="row-action" data-approve-account="${esc(account.id)}">Approve</button>`}</span></div>`).join('')}</section>`;
}

const fleetRoutes = {
  'GOK 482J': [
    { location:'Nakuru County Court',lat:-0.3031,lng:36.0800,speed:46 },
    { location:'Nakuru Law Courts Road',lat:-0.2918,lng:36.0713,speed:32 },
    { location:'Nakuru CBD',lat:-0.2837,lng:36.0692,speed:0 }
  ],
  'GOK 193A': [{ location:'Department HQ',lat:-1.2864,lng:36.8172,speed:0 }],
  'GOK 771M': [{ location:'Central Garage',lat:-1.3001,lng:36.8245,speed:0 }],
  'GOK 608K': [{ location:'Department HQ',lat:-1.2864,lng:36.8172,speed:0 }]
};
function fleetPosition(vehicle) {
  const route=fleetRoutes[vehicle.id];
  if(vehicle.status==='On assignment'&&route?.length){
    const point=route[Math.floor(Date.now()/15000)%route.length];
    return {...point,source:'Simulated GPS',updated:'Live demo feed'};
  }
  return {location:vehicle.location,lat:Number(vehicle.latitude)||-1.2864,lng:Number(vehicle.longitude)||36.8172,speed:Number(vehicle.speedKph)||0,source:vehicle.locationSource||'Manual update',updated:vehicle.locationUpdatedAt?new Date(vehicle.locationUpdatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'No signal'};
}
function fleetCanManage() { return isAdmin()||currentUser?.role==='Fleet Officer'; }
function renderFleetPage() {
  const canManage=fleetCanManage();
  const vehicles=data.vehicles.filter(matches);
  const moving=vehicles.filter(vehicle=>vehicle.status==='On assignment').length;
  return `${workflowHeader('Fleet management',canManage?'Manage vehicle assignments, fuel efficiency, mileage and service records.':'Fleet overview · read-only access for the Office of the PS.',`${canManage?'<button class="button primary" data-action="new-vehicle">+ Add vehicle</button>':''}<button class="button" data-nav="tracking">View live locations</button>`)}
    <div class="metrics">${metric('Fleet vehicles',vehicles.length,'Department-wide register','fleet','#fbe8ea','#b42332')}${metric('Currently on assignment',moving,'Demo GPS route feed for active trips','tracking','#eaf1f7','#426d91')}${metric('Average fuel use',`${(vehicles.reduce((sum,vehicle)=>sum+(Number(vehicle.fuelLitresPer100Km)||0),0)/Math.max(1,vehicles.length)).toFixed(1)} L/100 km`,'Recorded fleet average','fleet','#fbf0df','#a66725')}${metric('Total recorded mileage',`${vehicles.reduce((sum,vehicle)=>sum+(Number(vehicle.mileageKm)||0),0).toLocaleString()} km`,'Across visible fleet','tracking','#f5ece2','#a66725')}</div>
    <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Department fleet</h2><p class="panel-caption">Fuel use is recorded as litres per 100 kilometres.</p></div><div class="role-tag">${canManage?'Fleet management':'PS view · read only'}</div></div><div class="table-wrap"><table class="module-table"><thead><tr><th>Vehicle</th><th>Unit / driver</th><th>Status</th><th>Odometer</th><th>Fuel use</th><th>Location</th><th>Next service</th><th></th></tr></thead><tbody>${vehicles.map(vehicle=>{const position=fleetPosition(vehicle);return `<tr><td><strong>${esc(vehicle.id)}</strong><div class="subtext">${esc(vehicle.name)}</div></td><td>${esc(vehicle.unit)}<div class="subtext">${esc(vehicle.driver)}</div></td><td>${badge(vehicle.status)}</td><td>${Number(vehicle.mileageKm||0).toLocaleString()} km</td><td>${Number(vehicle.fuelLitresPer100Km||0).toFixed(1)} L/100 km</td><td>${esc(position.location)}<div class="subtext">${position.lat.toFixed(4)}, ${position.lng.toFixed(4)} · ${esc(position.source)}</div></td><td>${esc(vehicle.service)}</td><td>${canManage?`<button class="row-action" data-fleet-edit="${esc(vehicle.id)}">Update</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="8" class="empty-state">No fleet records match your search.</td></tr>'}</tbody></table></div></section>`;
}
function renderLiveTracking() {
  const vehicles=data.vehicles.filter(matches);
  const moving=vehicles.filter(vehicle=>vehicle.status==='On assignment');
  const markers=moving.map((vehicle,index)=>{const position=fleetPosition(vehicle);return `<span class="map-marker m${index%3+1}" title="${esc(vehicle.id)} · ${esc(position.location)}" style="left:${22+index*25}%;top:${37+(index%2)*18}%"></span>`;}).join('');
  return `${workflowHeader('Vehicle location tracking','Live fleet view · simulated demonstration GPS feed. No vehicle hardware is connected.',`<span class="role-tag">SIMULATED FEED</span>`)}<div class="tracking-layout"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Current vehicle locations</h2><p class="panel-caption">Trip locations cycle every 15 seconds in this demo.</p></div></div><div class="tracking-list">${vehicles.map(vehicle=>{const position=fleetPosition(vehicle);return `<div class="tracking-entry"><span class="track-pin">${svg('fleet')}</span><div><div class="track-title">${esc(vehicle.id)} <span class="subtext">· ${esc(vehicle.name)}</span></div><div class="track-meta">${esc(position.location)} · ${Number(position.speed||0)} km/h</div><div class="track-meta">${esc(vehicle.driver)} · ${esc(vehicle.status)} · ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}</div></div><span class="track-time">${esc(position.updated)}</span></div>`;}).join('')}</div></section><div class="panel map-panel" aria-label="Simulated vehicle positions"><div class="map-pattern"></div><div class="map-river"></div><span class="map-label one">Nairobi · HQ</span><span class="map-label two">Nakuru</span><span class="map-label three">Live trip</span>${markers}<div class="map-legend"><span><i class="legend-dot amber"></i>Vehicle in transit</span><span>Simulated GPS</span></div></div></div>`;
}
function renderServiceDesk() {
  const canManage=isAdmin()||currentUser?.role==='ICT Officer';
  const tickets=data.tickets.filter(ticket=>(canManage||ticket.requesterId===currentUser.id)&&matches(ticket));
  return `${workflowHeader('ICT service desk',canManage?'Review and update ICT requests across the department.':'Submit an ICT request and track its progress. Your list shows only requests you submitted.',`<button class="button primary" data-action="new-ticket">+ New request</button>`)}<section class="panel"><div class="page-toolbar"><div class="toolbar-left"><span class="subtext">${tickets.length} ${canManage?'department':'your'} requests</span></div><div class="toolbar-right"><input class="inline-search" id="moduleSearch" type="search" placeholder="Search ${canManage?'requests':'your requests'}" value="${esc(searchQuery)}"></div></div><div class="table-wrap"><table class="module-table"><thead><tr><th>Request</th><th>Requester</th><th>Type</th><th>Priority</th><th>Status</th><th>Last updated</th><th></th></tr></thead><tbody>${tickets.map(ticket=>`<tr><td><strong class="ticket-id">${esc(ticket.id)}</strong><div class="subtext">${esc(ticket.title)}</div></td><td>${esc(ticket.requester)}<div class="subtext">${esc(ticket.unit)}</div></td><td>${esc(ticket.category)}</td><td>${badge(ticket.priority)}</td><td>${badge(ticket.status)}</td><td>${esc(ticket.updated)}</td><td>${canManage?`<button class="row-action" data-row-action="ticket" data-id="${esc(ticket.id)}">Update status</button>`:''}</td></tr>`).join('')||'<tr><td class="empty-state" colspan="7">No ICT requests match this view.</td></tr>'}</tbody></table></div></section>`;
}
function openNewTicket() {
  const fields=[['title','Request title','text','Briefly describe the issue'],['category','Request type','select','Hardware|Software|Network access|Access request|Printing|Other'],['priority','Priority','select','Low|Normal|High|Urgent'],['unit','Department unit','select',`${currentUser.unit}|Legal Services|Human Rights|Constitutional Affairs|Administration|ICT Directorate`],['description','Description','textarea','Add relevant details']];
  openModal('New ICT service request',fields,'__ticket__','Submit request',values=>{
    const next=Math.max(1048,...data.tickets.map(ticket=>Number(ticket.id.replace(/\D/g,''))||0))+1;
    data.tickets.unshift({id:`HD-${next}`,title:values.title,category:values.category,priority:values.priority,requester:currentUser.name,requesterId:currentUser.id,unit:values.unit,status:'Open',updated:'Just now',description:values.description});
  });
}
function openFleetEditor(vehicle) {
  const fields=[['mileageKm','Odometer mileage (km)','number',''],['fuelLitresPer100Km','Fuel consumption (L/100 km)','number',''],['location','Current location','text','Town or facility'],['status','Vehicle status','select','Available|On assignment|Maintenance|Out of service']];
  openModal(`Update ${vehicle.id}`,fields,'__fleet-update__','Save vehicle details',values=>{
    vehicle.mileageKm=Number(values.mileageKm);vehicle.fuelLitresPer100Km=Number(values.fuelLitresPer100Km);vehicle.location=values.location;vehicle.status=values.status;vehicle.locationSource='Manual update';vehicle.locationUpdatedAt=new Date().toISOString();vehicle.latitude=Number(vehicle.latitude)||-1.2864;vehicle.longitude=Number(vehicle.longitude)||36.8172;
  });
  const form=document.getElementById('recordForm');
  form.elements.mileageKm.value=vehicle.mileageKm||0;form.elements.fuelLitresPer100Km.value=vehicle.fuelLitresPer100Km||0;form.elements.location.value=vehicle.location;form.elements.status.value=vehicle.status;
  form.elements.mileageKm.required=true;form.elements.fuelLitresPer100Km.required=true;
  form.elements.mileageKm.min='0';form.elements.mileageKm.step='1';form.elements.fuelLitresPer100Km.min='0';form.elements.fuelLitresPer100Km.step='0.1';
}
function openNewVehicle() {
  const fields=[['id','Registration number','text','e.g. GOK 123A'],['name','Vehicle make and model','text',''],['unit','Assigned unit','select','Legal Services|Human Rights|Constitutional Affairs|Administration'],['driver','Assigned driver','text',''],['status','Vehicle status','select','Available|On assignment|Maintenance|Out of service'],['mileageKm','Odometer mileage (km)','number','0'],['fuelLitresPer100Km','Fuel consumption (L/100 km)','number','0'],['location','Current location','text',''],['service','Next service date','date','']];
  openModal('Add fleet vehicle',fields,'__fleet-new__','Add vehicle',values=>{
    data.vehicles.unshift({...values,mileageKm:Number(values.mileageKm),fuelLitresPer100Km:Number(values.fuelLitresPer100Km),latitude:-1.2864,longitude:36.8172,locationSource:'Manual update',locationUpdatedAt:new Date().toISOString(),speedKph:0});
  });
  const form=document.getElementById('recordForm');form.elements.mileageKm.required=true;form.elements.fuelLitresPer100Km.required=true;form.elements.mileageKm.min='0';form.elements.mileageKm.step='1';form.elements.fuelLitresPer100Km.min='0';form.elements.fuelLitresPer100Km.step='0.1';
}

function bindModalClose(root) {
  root.querySelector('.modal-close')?.addEventListener('click',()=>root.innerHTML='');
  root.querySelector('[data-close]')?.addEventListener('click',()=>root.innerHTML='');
  root.querySelector('[data-dismiss]')?.addEventListener('click',event=>{if(event.target===event.currentTarget)root.innerHTML='';});
}
function addAttachment(record,kind,file) {
  if(!file)return;
  const allowed=['application/pdf','image/png','image/jpeg','text/plain'];
  if(!allowed.includes(file.type)){toast('Use a PDF, PNG, JPG or plain text file.');return;}
  if(file.size>500*1024){toast('This demo accepts files up to 500 KB.');return;}
  const total=[...data.memos,...data.documents].flatMap(item=>item.attachments||[]).reduce((sum,item)=>sum+item.size,0);
  if(total+file.size>2*1024*1024){toast('The demo attachment storage limit has been reached.');return;}
  const reader=new FileReader();reader.onload=()=>{
    const attachment={name:file.name,type:file.type,size:file.size,data:file.type==='text/plain'?null:reader.result,text:file.type==='text/plain'?reader.result:null};
    record.attachments.push(attachment);saveWorkflow();if(kind==='memo')openMemo(record.id);else openDocument(record.id);toast('Attachment added.');
  };
  if(file.type==='text/plain')reader.readAsText(file);else reader.readAsDataURL(file);
}
function bindPreviewButtons(root) {
  root.querySelectorAll('[data-preview-kind]').forEach(button=>button.addEventListener('click',()=>{
    const isMemo=button.dataset.previewKind==='memo';const records=isMemo?data.memos:data.documents;const record=records.find(item=>item.id===button.dataset.recordId);if(!record)return;
    if(isMemo&&!canAccessMemo(record)||!isMemo&&!canAccessDocument(record))return;
    const file=record.attachments[Number(button.dataset.fileIndex)];if(!file)return;
    let preview=file.type==='application/pdf'?`<iframe class="preview-frame" title="${esc(file.name)}" src="${esc(file.data)}"></iframe>`:file.type.startsWith('image/')?`<img class="preview-image" alt="${esc(file.name)}" src="${esc(file.data)}">`:`<pre style="white-space:pre-wrap;max-height:65vh;overflow:auto;font:12px/1.6 monospace">${esc(file.text||'')}</pre>`;
    const modal=document.getElementById('modalRoot');modal.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" data-preview-dismiss><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(file.name)}</h2><button class="modal-close" data-preview-close aria-label="Close preview">&times;</button></div><div class="modal-body">${preview}</div></section></div>`);
    modal.querySelector('[data-preview-close]').addEventListener('click',event=>event.currentTarget.closest('.modal-backdrop').remove());modal.querySelector('[data-preview-dismiss]').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.remove();});
  }));
}

function renderWorkflowApp() {
  if(!currentUser){renderSignIn();return;}
  if(!currentUser.active){currentUser=null;sessionStorage.removeItem('justice-ops-account');renderSignIn('This account is not active.');return;}
  if(!canOpenPage(currentPage))currentPage='overview';
  authScreen.style.display='none';appShell.style.display='flex';
  renderWorkflowNav();
  if(currentPage==='overview')content.innerHTML=renderWorkflowOverview();
  else if(currentPage==='memos')content.innerHTML=renderMemoList();
  else if(currentPage==='tasks')content.innerHTML=renderTasks();
  else if(currentPage==='documents')content.innerHTML=renderDocumentPage();
  else if(currentPage==='tickets')content.innerHTML=renderServiceDesk();
  else if(currentPage==='access')content.innerHTML=renderAccounts();
  else if(currentPage==='fleet')content.innerHTML=renderFleetPage();
  else if(currentPage==='tracking')content.innerHTML=renderLiveTracking();
  else content.innerHTML=renderModule(currentPage);
  document.getElementById('globalSearch').value=searchQuery;
}

render=renderWorkflowApp;
navRender=renderWorkflowNav;
document.getElementById('logoutButton').addEventListener('click',()=>{currentUser=null;sessionStorage.removeItem('justice-ops-account');localStorage.removeItem('justice-ops-account');document.getElementById('modalRoot').innerHTML='';render();});

document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-nav]');if(nav&&!canOpenPage(nav.dataset.nav)){event.preventDefault();return;}
  if(event.target.closest('[data-action="new-memo"]')){createMemo();return;}
  if(event.target.closest('[data-action="new-document"]')){createDocument();return;}
  if(event.target.closest('[data-action="delegate"]')){if(currentUser?.role==='HOD')openDelegation();return;}
  if(event.target.closest('[data-action="new-vehicle"]')){if(fleetCanManage())openNewVehicle();return;}
  if(event.target.closest('[data-action="new-ticket"]')){openNewTicket();return;}
  const fleetEdit=event.target.closest('[data-fleet-edit]');if(fleetEdit&&fleetCanManage()){const vehicle=data.vehicles.find(item=>item.id===fleetEdit.dataset.fleetEdit);if(vehicle)openFleetEditor(vehicle);return;}
  const memo=event.target.closest('[data-open-memo]');if(memo){openMemo(memo.dataset.openMemo);return;}
  const doc=event.target.closest('[data-open-document]');if(doc){openDocument(doc.dataset.openDocument);return;}
  const task=event.target.closest('[data-open-task]');if(task){openTask(task.dataset.openTask);return;}
  const approve=event.target.closest('[data-approve-account]');if(approve&&isAdmin()){
    const account=data.accounts.find(item=>item.id===approve.dataset.approveAccount);const role=document.querySelector(`[data-account-role="${CSS.escape(account.id)}"]`)?.value;
    if(account&&role){account.role=role;account.active=true;account.status='Active';saveWorkflow();render();toast('Account approved and role assigned.');}return;
  }
});

render();
setInterval(()=>{if(currentUser&&currentPage==='tracking')renderWorkflowApp();},15000);