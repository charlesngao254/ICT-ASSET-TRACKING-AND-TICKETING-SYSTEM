const workflowStages = ['PS approval', 'CFO action', 'Accounts processing', 'Completed'];
const workflowStageRole = { 'PS approval':'Permanent Secretary', 'CFO action':'CFO / Finance', 'Accounts processing':'Accounts Keeper' };
const workflowRoles = ['Staff','HOD','Permanent Secretary','CFO / Finance','Accounts Keeper','Records Officer','ICT Officer','Fleet Officer','System Administrator'];
data = { assets:[], tickets:[], vehicles:[], documents:[], tracking:[], memos:[], tasks:[], accounts:[] };
save = function() {};
const apiBase = '/api/v1';
let apiToken = sessionStorage.getItem('justice-ops-token') || localStorage.getItem('justice-ops-token') || null;
let currentUser = null;
let departmentUsers = [];
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
  return Boolean(currentUser) && data.memos.some(item => item.id === memo.id);
}
function canAccessDocument(doc) {
  return Boolean(currentUser) && (currentUser.role === 'Records Officer' || doc.shared === true || doc.ownerId === currentUser.id);
}
function visibleMemos() { return data.memos; }
function roleNav() { return workflowNavigation.filter(([page]) => canOpenPage(page)); }
function workflowDate() { return new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function money(value) { return new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(Number(value)||0); }
function roleAccount(role) { return data.accounts.find(account => account.active && account.role === role); }
function saveWorkflow() {}
function apiUser(user) {
  return { id:user.id, name:user.full_name, email:user.email, unit:user.department, role:user.role, active:user.status==='Active', status:user.status, requestedRole:user.requested_role };
}
function uiMemo(memo) {
  return { id:memo.id, title:memo.title, activity:memo.activity, amount:Number(memo.amount), unit:memo.department, initiatorId:memo.initiator_id, initiatorName:data.accounts.find(user=>user.id===memo.initiator_id)?.name||String(memo.initiator_id).slice(0,8), stage:memo.stage, shared:memo.shared_with_department, createdAt:new Date(memo.created_at).toLocaleDateString('en-GB'), participantIds:[], attachments:[], comments:[], history:[] };
}
function uiDocument(document) {
  return { id:document.id, title:document.title, type:document.document_type, unit:document.department, ownerId:document.owner_id, owner:data.accounts.find(user=>user.id===document.owner_id)?.name||currentUser?.name||'Document owner', date:new Date(document.created_at).toLocaleDateString('en-GB'), status:document.workflow_status, shared:document.shared_with_department, attachments:[], comments:[] };
}
function uiTicket(ticket) {
  return { id:ticket.id, title:ticket.title, category:ticket.category, priority:ticket.priority, requester:ticket.requester_id===currentUser?.id?currentUser.name:ticket.requester_id.slice(0,8), requesterId:ticket.requester_id, unit:ticket.department, status:ticket.status, updated:new Date(ticket.updated_at).toLocaleString('en-GB'), description:ticket.description };
}
function uiVehicle(vehicle) {
  return { id:vehicle.id, registration:vehicle.registration, name:vehicle.make_model, unit:vehicle.department, driver:vehicle.driver, status:vehicle.status, mileageKm:vehicle.odometer_km, fuelLitresPer100Km:Number(vehicle.fuel_litres_per_100km), location:vehicle.current_location, latitude:vehicle.latitude, longitude:vehicle.longitude, speedKph:vehicle.speed_kph, locationSource:vehicle.location_source, locationUpdatedAt:vehicle.location_updated_at, service:vehicle.next_service_date||'' };
}
function uiTask(task) {
  return { id:task.id, title:task.title, detail:task.instructions, fromId:task.assigner_id, toId:task.assignee_id, unit:task.department, due:task.due_date, status:task.status, comments:[] };
}
async function apiRequest(path,options={}) {
  const headers=new Headers(options.headers||{});
  if(apiToken)headers.set('Authorization',`Bearer ${apiToken}`);
  if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
  const response=await fetch(`${apiBase}${path}`,{...options,headers});
  if(response.status===204)return null;
  const contentType=response.headers.get('content-type')||'';
  const body=contentType.includes('application/json')?await response.json():await response.text();
  if(!response.ok){
    if(response.status===401&&apiToken){apiToken=null;sessionStorage.removeItem('justice-ops-token');localStorage.removeItem('justice-ops-token');}
    const error=new Error(body?.detail||body||`Request failed (${response.status})`);
    error.status=response.status;
    throw error;
  }
  return body;
}
async function loadApiData() {
  const requests={memos:apiRequest('/memos?limit=100'),documents:apiRequest('/documents?limit=100'),tickets:apiRequest('/tickets?limit=100'),tasks:apiRequest('/tasks?limit=100')};
  if(isAdmin()||currentUser.role==='ICT Officer')requests.assets=apiRequest('/assets?limit=250');
  if(isAdmin())requests.accounts=apiRequest('/admin/users');
  if(isAdmin())requests.pendingAccounts=apiRequest('/admin/access-requests');
  if(currentUser.role==='HOD')requests.taskAssignees=apiRequest('/tasks/assignees');
  if(['Fleet Officer','Permanent Secretary','System Administrator'].includes(currentUser.role))requests.vehicles=apiRequest('/fleet/vehicles?limit=250');
  const results=await Promise.allSettled(Object.entries(requests).map(([,request])=>request));
  const loaded={};
  results.forEach((result,index)=>{const key=Object.keys(requests)[index];if(result.status==='fulfilled')loaded[key]=result.value;else if(result.reason?.status!==403)throw result.reason;});
  if(loaded.accounts)data.accounts=loaded.accounts.map(apiUser);
  if(loaded.pendingAccounts)data.accounts=[...data.accounts,...loaded.pendingAccounts.map(apiUser)];
  departmentUsers=(loaded.taskAssignees||[]).map(apiUser);
  data.memos=(loaded.memos||[]).map(uiMemo);
  data.documents=(loaded.documents||[]).map(uiDocument);
  data.tickets=(loaded.tickets||[]).map(uiTicket);
  data.tasks=(loaded.tasks||[]).map(uiTask);
  data.assets=(loaded.assets||[]).map(asset=>({id:asset.id,name:asset.name,tag:asset.asset_tag,category:asset.category,assigned:asset.department,custodian:asset.custodian,condition:asset.condition,status:asset.status,location:asset.location}));
  data.vehicles=(loaded.vehicles||[]).map(uiVehicle);
}

function renderSignIn(message='') {
  appShell.style.display = 'none';
  authScreen.style.display = 'block';
  const active = data.accounts.filter(account => account.active && account.role !== 'Pending approval');
  authScreen.innerHTML = `<div class="auth-layout"><section class="auth-form"><header class="auth-header"><div class="auth-mark"><img class="auth-seal" src="assets/kenya-coat-of-arms.png" alt="Coat of Arms of Kenya"><p>SDJHRCA <span>|</span><strong>ICT Department</strong></p></div><h1 class="auth-heading">Sign in to access the asset management system</h1></header><form id="demoLogin"><div class="auth-fields"><div class="auth-field"><label for="loginEmail">Email Address</label><input id="loginEmail" name="email" type="email" placeholder="e.g. admin@justice.gov" autocomplete="username" required><p class="auth-description">Use your department email to sign in.</p></div><div class="auth-field"><label for="loginPassword">Password</label><div class="auth-input-wrap"><input id="loginPassword" name="password" type="password" placeholder="Enter password" autocomplete="current-password" required><button class="auth-password-toggle" id="togglePassword" type="button" aria-label="Show password"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><p class="auth-description">Use the password associated with your account.</p></div></div><div class="auth-options"><label class="auth-remember"><input id="keepLoggedIn" type="checkbox" checked>Keep me logged in</label><button class="auth-link" id="forgotPassword" type="button">forgot password?</button></div><div class="auth-message" id="authMessage">${esc(message)}</div><button class="auth-submit" id="signInButton" type="submit" disabled>Sign In</button><p class="auth-access">Don't have an account yet? <button id="showRegistration" type="button">Request access</button></p><p class="auth-demo-note">Passwords are checked by the department server. Contact your administrator if you need password assistance.</p></form></section></div><footer class="auth-footer">© 2026 SDJHRCA. ICT Asset Management System. All rights reserved.</footer>`;
  const form=authScreen.querySelector('#demoLogin');
  const email=authScreen.querySelector('#loginEmail');
  const password=authScreen.querySelector('#loginPassword');
  const signInButton=authScreen.querySelector('#signInButton');
  const updateSubmit=()=>{signInButton.disabled=!(email.value.trim()&&password.value);};
  form.addEventListener('input',updateSubmit);
  authScreen.querySelector('#demoLogin').addEventListener('submit',async event=>{
    event.preventDefault();
    signInButton.disabled=true;
    try {
      const session=await apiRequest('/auth/login',{method:'POST',body:JSON.stringify({email:email.value.trim(),password:password.value})});
      apiToken=session.access_token;currentUser=apiUser(session.user);
      if(authScreen.querySelector('#keepLoggedIn').checked){localStorage.setItem('justice-ops-token',apiToken);sessionStorage.removeItem('justice-ops-token');}
      else {sessionStorage.setItem('justice-ops-token',apiToken);localStorage.removeItem('justice-ops-token');}
      currentPage='overview';await loadApiData();render();
    } catch(error) {
      authScreen.querySelector('#authMessage').textContent=error.message;
      signInButton.disabled=false;
    }
  });
  authScreen.querySelector('#togglePassword').addEventListener('click',event=>{
    const visible=password.type==='text';password.type=visible?'password':'text';event.currentTarget.setAttribute('aria-label',visible?'Show password':'Hide password');
  });
  authScreen.querySelector('#forgotPassword').addEventListener('click',()=>{authScreen.querySelector('#authMessage').textContent='Contact your system administrator to reset your password.';});
  authScreen.querySelector('#showRegistration').addEventListener('click',renderRegistration);
}
function renderRegistration() {
  authScreen.innerHTML = `<div class="auth-layout"><section class="auth-form"><header class="auth-header"><div class="auth-mark"><img class="auth-seal" src="assets/kenya-coat-of-arms.png" alt="Coat of Arms of Kenya"><p>SDJHRCA <span>|</span><strong>ICT Department</strong></p></div><h1 class="auth-heading">Request access to the asset management system</h1></header><p class="auth-description" style="margin-bottom:20px">Provide your details and set a password. An administrator assigns your role after review.</p><div class="auth-message" id="registrationMessage"></div><form id="registrationForm"><div class="auth-fields"><div class="auth-field"><label for="regName">Full name</label><input id="regName" name="full_name" required maxlength="120"></div><div class="auth-field"><label for="regEmail">Email Address</label><input id="regEmail" name="email" type="email" required maxlength="150"></div><div class="auth-field"><label for="regUnit">Department unit</label><input id="regUnit" name="department" required maxlength="120"></div><div class="auth-field"><label for="regRole">Requested role</label><select id="regRole" name="requested_role">${workflowRoles.filter(role=>role!=='System Administrator').map(role=>`<option>${esc(role)}</option>`).join('')}</select></div><div class="auth-field"><label for="regPassword">Password (minimum 12 characters)</label><input id="regPassword" name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></div></div><button class="auth-submit" style="margin-top:22px" type="submit">Request access</button></form><p class="auth-access"><button id="showLogin" type="button">Back to sign in</button></p><p class="auth-demo-note">Your password is hashed by the server and is not visible to the approver.</p></section></div><footer class="auth-footer">© 2026 SDJHRCA. ICT Asset Management System. All rights reserved.</footer>`;
  authScreen.querySelector('#showLogin').addEventListener('click',()=>renderSignIn());
  authScreen.querySelector('#registrationForm').addEventListener('submit',async event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await apiRequest('/auth/access-requests',{method:'POST',body:JSON.stringify(values)});
      renderSignIn('Access request submitted. The administrator will review it.');
    } catch(error) {
      authScreen.querySelector('#registrationMessage').textContent=error.message;
    }
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
  return `<div class="page-heading"><div><p class="eyebrow">Department workflow</p><h1>${esc(title)}</h1><p class="heading-sub">${esc(sub)}<span class="prototype-note">Connected to PostgreSQL</span></p></div><div class="heading-actions">${action}</div></div>`;
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
  openModal('Submit activity memo',fields,'memo','Submit to PS',async values=>{
    const memo=await apiRequest('/memos',{method:'POST',body:JSON.stringify({title:values.title,activity:values.activity,amount:Number(values.amount),shared_with_department:values.shared.startsWith('Yes')})});
    data.memos.unshift(uiMemo(memo));
  });
}
function workflowProgress(memo) {
  const active=stageIndex(memo.stage);
  return `<div class="stage-line">${workflowStages.map((stage,index)=>`<span class="stage-step ${memo.stage==='Completed'||index<active?'done':index===active?'current':''}">${index+1}. ${esc(stage)}</span>`).join('')}</div>`;
}
function memoCommentVisible(comment,memo) {
  return comment.authorId===currentUser.id || (memo.shared && comment.visibility==='everyone');
}
async function openMemo(memoId) {
  const memo=data.memos.find(item=>item.id===memoId);
  if(!memo||!canAccessMemo(memo))return;
  try {
    const [comments,history,attachments]=await Promise.all([
      apiRequest(`/memos/${memo.id}/comments`),
      apiRequest(`/memos/${memo.id}/events`),
      apiRequest(`/memos/${memo.id}/attachments`)
    ]);
    memo.comments=comments.map(comment=>({id:comment.id,authorId:comment.author_id,authorName:data.accounts.find(user=>user.id===comment.author_id)?.name||(comment.author_id===currentUser.id?currentUser.name:'Department user'),body:comment.body,visibility:comment.visible_to_department?'everyone':'private',date:new Date(comment.created_at).toLocaleString('en-GB')}));
    memo.history=history.map(entry=>({stage:entry.event,actor:data.accounts.find(user=>user.id===entry.actor_id)?.name||(entry.actor_id===currentUser.id?currentUser.name:'Department user'),date:new Date(entry.created_at).toLocaleString('en-GB')}));
    memo.attachments=attachments.map(file=>({id:file.id,name:file.original_filename,size:file.size_bytes,type:file.content_type}));
  } catch(error) { toast(error.message);return; }
  const comments=(memo.comments||[]).filter(comment=>memoCommentVisible(comment,memo));
  const canAct=workflowStageRole[memo.stage]===currentUser.role;
  const isInitiator=memo.initiatorId===currentUser.id;
  const stageButtons=canAct?`<div class="memo-actions">${memo.stage==='PS approval'?'<button class="button primary" data-memo-transition="CFO action">Approve and forward to CFO</button>':''}${memo.stage==='CFO action'?'<button class="button primary" data-memo-transition="Accounts processing">Complete finance action; forward to Accounts</button>':''}${memo.stage==='Accounts processing'?'<button class="button primary" data-memo-transition="Completed">Mark accounts action complete</button>':''}<button class="button" data-memo-transition="Returned">Return to initiator</button></div>`:'';
  const resubmit=isInitiator&&memo.stage==='Returned'?'<button class="button primary" data-memo-transition="PS approval">Resubmit to PS</button>':'';
  const attachmentRows=(memo.attachments||[]).map(file=>`<div class="attachment-row"><span>${esc(file.name)} <span class="subtext">${Math.ceil(file.size/1024)} KB</span></span><button class="row-action" data-preview-kind="memo" data-record-id="${esc(memo.id)}" data-file-id="${esc(file.id)}">Preview</button></div>`).join('')||'<p class="subtext">No attachments yet.</p>';
  const commentRows=comments.map(comment=>`<div class="comment-item"><div class="comment-meta"><span>${esc(comment.authorName)} · ${esc(comment.date)}</span><span>${comment.visibility==='everyone'?'Shared':'Only you'}</span></div>${esc(comment.body)}</div>`).join('')||'<p class="subtext">No comments visible to you.</p>';
  const root=document.getElementById('modalRoot');
  root.innerHTML=`<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><div class="modal-head"><div><h2 id="detailTitle">${esc(memo.title)}</h2><p class="panel-caption">${esc(memo.id)} · Initiated by ${esc(memo.initiatorName)}</p></div><button class="modal-close" aria-label="Close dialog">&times;</button></div><div class="modal-body"><div class="detail-block"><div class="stage-line" style="margin-bottom:10px">${workflowProgress(memo)}</div><div>${stageButtons}${resubmit}</div><div class="subtext" style="margin-top:10px">Current stage: ${esc(memo.stage)} · ${money(memo.amount)} · ${esc(memo.unit)}</div></div><div class="detail-grid"><div><div class="detail-block"><h3>Activity and purpose</h3><div style="font-size:11px;line-height:1.55">${esc(memo.activity)}</div></div><div class="detail-block"><h3>Attachments</h3>${attachmentRows}${isInitiator?'<label class="button" style="margin-top:8px;display:inline-flex">Attach file<input id="memoFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" hidden></label>':''}<p class="subtext" style="margin-top:8px">PDF, PNG, JPG or TXT · 500 KB per file in this demo.</p></div><div class="detail-block"><h3>Workflow history</h3>${memo.history.map(entry=>`<div class="comment-item"><div class="comment-meta"><span>${esc(entry.actor)}</span><span>${esc(entry.date)}</span></div>${esc(entry.stage)}</div>`).join('')}</div></div><div><div class="detail-block"><h3>Comments</h3><p class="private-note">Private comments are visible only to their author. Shared comments are visible to everyone only when the memo is shared.</p>${commentRows}<form id="memoCommentForm"><div class="field"><label for="memoComment">Add a comment</label><textarea id="memoComment" name="body" required maxlength="1500" placeholder="Write a comment"></textarea></div>${memo.shared?'<label class="field" style="display:flex;align-items:center;gap:7px;margin:9px 0"><input type="checkbox" name="everyone" value="yes"> Visible to everyone</label>':''}<button class="button" type="submit">Post comment</button></form></div></div></div></div></section></div>`;
  bindModalClose(root);
  root.querySelector('#memoCommentForm').addEventListener('submit',async event=>{
    event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await apiRequest(`/memos/${memo.id}/comments`,{method:'POST',body:JSON.stringify({body:values.body,visible_to_department:values.everyone==='yes'})});await openMemo(memo.id); }
    catch(error) { toast(error.message); }
  });
  root.querySelector('[data-memo-transition]')?.closest('.detail-block')?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-memo-transition]');if(!button)return;
    const next=button.dataset.memoTransition;
    if(next==='Returned'&&!window.confirm('Return this memo to its initiator?'))return;
    if(next!=='Returned'&&next!=='PS approval'&&workflowStageRole[memo.stage]!==currentUser.role)return;
      const actions={'CFO action':'approve','Accounts processing':'forward','Completed':'complete','Returned':'return','PS approval':'resubmit'};
      try {
        const updated=await apiRequest(`/memos/${memo.id}/transition`,{method:'POST',body:JSON.stringify({action:actions[next]})});
        Object.assign(memo,uiMemo(updated));render();await openMemo(memo.id);
      } catch(error) { toast(error.message); }
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
  openModal('Register document',fields,'document','Register document',async values=>{
    const document=await apiRequest('/documents',{method:'POST',body:JSON.stringify({title:values.title,document_type:values.type,shared_with_department:values.shared.startsWith('Yes')})});
    data.documents.unshift(uiDocument(document));
  });
}
async function openDocument(docId) {
  const doc=data.documents.find(item=>item.id===docId);if(!doc||!canAccessDocument(doc))return;
  try {
    const [comments,attachments]=await Promise.all([
      apiRequest(`/documents/${doc.id}/comments`),
      apiRequest(`/documents/${doc.id}/attachments`)
    ]);
    doc.comments=comments.map(comment=>({id:comment.id,authorId:comment.author_id,authorName:data.accounts.find(user=>user.id===comment.author_id)?.name||(comment.author_id===currentUser.id?currentUser.name:'Department user'),body:comment.body,visibility:comment.visible_to_department?'everyone':'private',date:new Date(comment.created_at).toLocaleString('en-GB')}));
    doc.attachments=attachments.map(file=>({id:file.id,name:file.original_filename,size:file.size_bytes,type:file.content_type}));
  } catch(error) { toast(error.message);return; }
  const visibleComments=(doc.comments||[]).filter(comment=>comment.authorId===currentUser.id||(doc.shared&&comment.visibility==='everyone'));
  const attachments=(doc.attachments||[]).map((file,index)=>`<div class="attachment-row"><span>${esc(file.name)} <span class="subtext">${Math.ceil(file.size/1024)} KB</span></span><button class="row-action" data-preview-kind="document" data-record-id="${esc(doc.id)}" data-file-index="${index}">Preview</button></div>`).join('')||'<p class="subtext">No attachments yet.</p>';
  const comments=visibleComments.map(comment=>`<div class="comment-item"><div class="comment-meta"><span>${esc(comment.authorName)} · ${esc(comment.date)}</span><span>${comment.visibility==='everyone'?'Shared':'Only you'}</span></div>${esc(comment.body)}</div>`).join('')||'<p class="subtext">No comments visible to you.</p>';
  const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><div class="modal-head"><div><h2 id="detailTitle">${esc(doc.title)}</h2><p class="panel-caption">${esc(doc.id)} · ${doc.shared?'Shared with everyone':'Private document'}</p></div><button class="modal-close" aria-label="Close dialog">&times;</button></div><div class="modal-body"><div class="detail-grid"><div class="detail-block"><h3>Document details</h3><p class="subtext">${esc(doc.type)} · ${esc(doc.unit)} · ${esc(doc.date)}</p><p style="font-size:11px">Owner: ${esc(doc.owner)}</p><h3>Attachments</h3>${attachments}<label class="button" style="margin-top:8px;display:inline-flex">Attach file<input id="documentFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" hidden></label><p class="subtext" style="margin-top:8px">PDF, PNG, JPG or TXT · preview opens here without downloading.</p></div><div class="detail-block"><h3>Comments</h3><p class="private-note">Comments are private to their author unless explicitly shared on a document shared with everyone.</p>${comments}<form id="documentCommentForm"><div class="field"><label for="documentComment">Add a comment</label><textarea id="documentComment" name="body" required maxlength="1500"></textarea></div>${doc.shared?'<label class="field" style="display:flex;align-items:center;gap:7px;margin:9px 0"><input type="checkbox" name="everyone" value="yes"> Visible to everyone</label>':''}<button class="button" type="submit">Post comment</button></form></div></div></div></section></div>`;
  bindModalClose(root);
  root.querySelector('#documentCommentForm').addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());try{await apiRequest(`/documents/${doc.id}/comments`,{method:'POST',body:JSON.stringify({body:values.body,visible_to_department:values.everyone==='yes'})});await openDocument(doc.id);}catch(error){toast(error.message);}});
  root.querySelector('#documentFile').addEventListener('change',event=>addAttachment(doc,'document',event.target.files?.[0]));bindPreviewButtons(root);
}

function canAccessTask(task) { return currentUser && (task.fromId===currentUser.id || task.toId===currentUser.id); }
function renderTasks() {
  const tasks=data.tasks.filter(canAccessTask).filter(matches);
  return `${workflowHeader('Delegated tasks','HOD assignments are private to the HOD and intended staff member.',currentUser.role==='HOD'?'<button class="button primary" data-action="delegate">+ Delegate a task</button>':'')}<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Tasks assigned to or by you</h2><p class="panel-caption">Private task list · not visible to department members</p></div></div><div class="tracking-list">${tasks.map(task=>`<article class="tracking-entry task-private"><span class="track-pin">${svg('tickets')}</span><div><div class="track-title">${esc(task.title)} ${badge(task.status)}</div><div class="track-meta">${esc(task.detail)}</div><div class="track-meta">${task.toId===currentUser.id?'Assigned to you':'Assigned by you'} · Due ${esc(task.due)}</div><button class="row-action" data-open-task="${esc(task.id)}">Open private task</button></div></article>`).join('')||'<div class="empty-state">No tasks assigned to or by this account.</div>'}</div></section>`;
}
function openDelegation() {
  const staff=departmentUsers.filter(account=>account.active&&account.role==='Staff');
  if(!staff.length){toast('No active staff accounts in your unit are available for assignment.');return;}
  const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="delegateTitle"><div class="modal-head"><h2 id="delegateTitle">Delegate a private task</h2><button class="modal-close" aria-label="Close dialog">&times;</button></div><form id="delegateForm" class="modal-body"><div class="form-grid"><div class="field full"><label for="delegateTitleInput">Task title</label><input id="delegateTitleInput" name="title" required maxlength="120"></div><div class="field full"><label for="delegateDetail">Instructions</label><textarea id="delegateDetail" name="detail" required maxlength="1000"></textarea></div><div class="field"><label for="delegateTo">Assign to</label><select id="delegateTo" name="toId">${staff.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></div><div class="field"><label for="delegateDue">Due date</label><input id="delegateDue" type="date" name="due" required></div></div><p class="private-note">Only you and the selected staff member can see this task and its comments.</p><div class="modal-actions"><button class="button" type="button" data-close>Cancel</button><button class="button primary" type="submit">Assign privately</button></div></form></section></div>`;
  bindModalClose(root);root.querySelector('#delegateForm').addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());try{const task=await apiRequest('/tasks',{method:'POST',body:JSON.stringify({title:values.title,instructions:values.detail,assignee_id:values.toId,due_date:values.due})});data.tasks.unshift(uiTask(task));root.innerHTML='';render();toast('Task assigned privately.');}catch(error){toast(error.message);}});
}
async function openTask(taskId) {
  const task=data.tasks.find(item=>item.id===taskId);if(!task||!canAccessTask(task))return;
  try {task.comments=(await apiRequest(`/tasks/${task.id}/comments`)).map(comment=>({authorName:comment.author_id===currentUser.id?currentUser.name:String(comment.author_id).slice(0,8),body:comment.body,date:new Date(comment.created_at).toLocaleString('en-GB')}));}
  catch(error){toast(error.message);return;}
  const comments=(task.comments||[]).map(comment=>`<div class="comment-item"><div class="comment-meta"><span>${esc(comment.authorName)} · ${esc(comment.date)}</span></div>${esc(comment.body)}</div>`).join('')||'<p class="subtext">No private messages yet.</p>';
  const recipient=task.toId===currentUser.id;
  const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="taskTitle"><div class="modal-head"><div><h2 id="taskTitle">${esc(task.title)}</h2><p class="panel-caption">Private task · ${esc(task.unit)} · Due ${esc(task.due)}</p></div><button class="modal-close" aria-label="Close dialog">&times;</button></div><div class="modal-body"><div class="detail-block"><h3>Instructions</h3><p style="font-size:11px;line-height:1.6">${esc(task.detail)}</p><p>${badge(task.status)}</p>${recipient&&task.status!=='Completed'?'<button class="button primary" data-task-complete>Mark task complete</button>':''}</div><div class="detail-block"><h3>Private conversation</h3><p class="private-note">Visible only to the assigning HOD and intended staff member.</p>${comments}<form id="taskCommentForm"><div class="field"><label for="taskMessage">Reply</label><textarea id="taskMessage" name="body" required maxlength="1000"></textarea></div><button class="button" type="submit">Send private reply</button></form></div></div></section></div>`;
  bindModalClose(root);root.querySelector('#taskCommentForm').addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget).entries());try{await apiRequest(`/tasks/${task.id}/comments`,{method:'POST',body:JSON.stringify({body:values.body})});await openTask(task.id);}catch(error){toast(error.message);}});root.querySelector('[data-task-complete]')?.addEventListener('click',async()=>{try{const updated=await apiRequest(`/tasks/${task.id}`,{method:'PATCH',body:JSON.stringify({status:'Completed'})});Object.assign(task,uiTask(updated));render();await openTask(task.id);}catch(error){toast(error.message);}});
}

function renderAccounts() {
  if(!isAdmin())return '<div class="empty-state">This area is restricted to system administrators.</div>';
  return `${workflowHeader('Account access','Approve account requests and assign an authorized role. Roles are granted by the administrator, not selected at sign-in.')}<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Department accounts</h2><p class="panel-caption">Account roles control which records and actions are presented in the workspace.</p></div></div><div class="account-row" style="font-weight:700;color:#78888a"><span>Account</span><span>Department unit</span><span>Current role</span><span>Access</span><span>Action</span></div>${data.accounts.map(account=>`<div class="account-row"><span><strong>${esc(account.name)}</strong><div class="subtext">${esc(account.email)}</div></span><span>${esc(account.unit)}</span><span>${account.active?`<span class="role-tag">${esc(account.role)}</span>`:`<select class="filter-select" data-account-role="${esc(account.id)}">${workflowRoles.filter(role=>role!=='System Administrator').map(role=>`<option ${role===account.requestedRole?'selected':''}>${esc(role)}</option>`).join('')}</select>`}</span><span>${account.active?badge('Active'):badge('Pending approval')}</span><span>${account.active?'<span class="subtext">Assigned</span>':`<button class="row-action" data-approve-account="${esc(account.id)}">Approve</button>`}</span></div>`).join('')}</section>`;
}

function fleetPosition(vehicle) {
  const lat=vehicle.latitude===null||vehicle.latitude===undefined||vehicle.latitude===''?null:Number(vehicle.latitude);
  const lng=vehicle.longitude===null||vehicle.longitude===undefined||vehicle.longitude===''?null:Number(vehicle.longitude);
  return {location:vehicle.location||'Location not reported',lat:Number.isFinite(lat)?lat:null,lng:Number.isFinite(lng)?lng:null,speed:Number(vehicle.speedKph)||0,source:vehicle.locationSource||'No live device signal',updated:vehicle.locationUpdatedAt?new Date(vehicle.locationUpdatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'No GPS report'};
}
function fleetCanManage() { return isAdmin()||currentUser?.role==='Fleet Officer'; }
function renderFleetPage() {
  const canManage=fleetCanManage();
  const vehicles=data.vehicles.filter(matches);
  const moving=vehicles.filter(vehicle=>vehicle.status==='On assignment').length;
  return `${workflowHeader('Fleet management',canManage?'Manage vehicle assignments, fuel efficiency, mileage and service records.':'Fleet overview · read-only access for the Office of the PS.',`${canManage?'<button class="button primary" data-action="new-vehicle">+ Add vehicle</button>':''}<button class="button" data-nav="tracking">View reported locations</button>`)}
    <div class="metrics">${metric('Fleet vehicles',vehicles.length,'Department-wide register','fleet','#fbe8ea','#b42332')}${metric('Currently on assignment',moving,'Demo GPS route feed for active trips','tracking','#eaf1f7','#426d91')}${metric('Average fuel use',`${(vehicles.reduce((sum,vehicle)=>sum+(Number(vehicle.fuelLitresPer100Km)||0),0)/Math.max(1,vehicles.length)).toFixed(1)} L/100 km`,'Recorded fleet average','fleet','#fbf0df','#a66725')}${metric('Total recorded mileage',`${vehicles.reduce((sum,vehicle)=>sum+(Number(vehicle.mileageKm)||0),0).toLocaleString()} km`,'Across visible fleet','tracking','#f5ece2','#a66725')}</div>
    <section class="panel"><div class="panel-head"><div><h2 class="panel-title">Department fleet</h2><p class="panel-caption">Fuel use is recorded as litres per 100 kilometres.</p></div><div class="role-tag">${canManage?'Fleet management':'PS view · read only'}</div></div><div class="table-wrap"><table class="module-table"><thead><tr><th>Vehicle</th><th>Unit / driver</th><th>Status</th><th>Odometer</th><th>Fuel use</th><th>Location</th><th>Next service</th><th></th></tr></thead><tbody>${vehicles.map(vehicle=>{const position=fleetPosition(vehicle);const coordinates=position.lat===null||position.lng===null?'No GPS report':`${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;return `<tr><td><strong>${esc(vehicle.registration)}</strong><div class="subtext">${esc(vehicle.name)}</div></td><td>${esc(vehicle.unit)}<div class="subtext">${esc(vehicle.driver)}</div></td><td>${badge(vehicle.status)}</td><td>${Number(vehicle.mileageKm||0).toLocaleString()} km</td><td>${Number(vehicle.fuelLitresPer100Km||0).toFixed(1)} L/100 km</td><td>${esc(position.location)}<div class="subtext">${coordinates} · ${esc(position.source)}</div></td><td>${esc(vehicle.service)}</td><td>${canManage?`<button class="row-action" data-fleet-edit="${esc(vehicle.id)}">Update</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="8" class="empty-state">No fleet records match your search.</td></tr>'}</tbody></table></div></section>`;
}
function renderLiveTracking() {
  const vehicles=data.vehicles.filter(matches);
  const moving=vehicles.filter(vehicle=>vehicle.status==='On assignment');
  const located=vehicles.filter(vehicle=>fleetPosition(vehicle).lat!==null&&fleetPosition(vehicle).lng!==null);
  const markers=located.map((vehicle,index)=>{const position=fleetPosition(vehicle);const x=Math.min(88,Math.max(8,50+(position.lng-36.8172)*22));const y=Math.min(84,Math.max(12,50-(position.lat+1.2864)*22));return `<span class="map-marker m${index%3+1}" title="${esc(vehicle.registration)} · ${esc(position.location)}" style="left:${x}%;top:${y}%"></span>`;}).join('');
  return `${workflowHeader('Vehicle location tracking','Latest position reports received by the system. Automatic live updates require an authorized GPS/telematics feed.',`<span class="role-tag">${located.length} location reports</span>`)}<div class="tracking-layout"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Reported vehicle locations</h2><p class="panel-caption">Position and timestamp are taken from the PostgreSQL fleet location feed.</p></div></div><div class="tracking-list">${vehicles.map(vehicle=>{const position=fleetPosition(vehicle);const coordinates=position.lat===null||position.lng===null?'No GPS report':`${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;return `<div class="tracking-entry"><span class="track-pin">${svg('fleet')}</span><div><div class="track-title">${esc(vehicle.registration)} <span class="subtext">· ${esc(vehicle.name)}</span></div><div class="track-meta">${esc(position.location)} · ${Number(position.speed||0)} km/h</div><div class="track-meta">${esc(vehicle.driver)} · ${esc(vehicle.status)} · ${coordinates}</div></div><span class="track-time">${esc(position.updated)}</span></div>`;}).join('')||'<div class="empty-state">No vehicles have reported a location yet.</div>'}</div></section><div class="panel map-panel" aria-label="Reported vehicle positions"><div class="map-pattern"></div><div class="map-river"></div><span class="map-label one">Nairobi · HQ</span><span class="map-label two">Nakuru</span><span class="map-label three">Vehicle report</span>${markers}<div class="map-legend"><span><i class="legend-dot amber"></i>Vehicle location report</span></div></div></div>`;
}
function renderServiceDesk() {
  const canManage=isAdmin()||currentUser?.role==='ICT Officer';
  const tickets=data.tickets.filter(ticket=>(canManage||ticket.requesterId===currentUser.id)&&matches(ticket));
  return `${workflowHeader('ICT service desk',canManage?'Review and update ICT requests across the department.':'Submit an ICT request and track its progress. Your list shows only requests you submitted.',`<button class="button primary" data-action="new-ticket">+ New request</button>`)}<section class="panel"><div class="page-toolbar"><div class="toolbar-left"><span class="subtext">${tickets.length} ${canManage?'department':'your'} requests</span></div><div class="toolbar-right"><input class="inline-search" id="moduleSearch" type="search" placeholder="Search ${canManage?'requests':'your requests'}" value="${esc(searchQuery)}"></div></div><div class="table-wrap"><table class="module-table"><thead><tr><th>Request</th><th>Requester</th><th>Type</th><th>Priority</th><th>Status</th><th>Last updated</th><th></th></tr></thead><tbody>${tickets.map(ticket=>`<tr><td><strong class="ticket-id">${esc(ticket.id)}</strong><div class="subtext">${esc(ticket.title)}</div></td><td>${esc(ticket.requester)}<div class="subtext">${esc(ticket.unit)}</div></td><td>${esc(ticket.category)}</td><td>${badge(ticket.priority)}</td><td>${badge(ticket.status)}</td><td>${esc(ticket.updated)}</td><td>${canManage?`<button class="row-action" data-row-action="ticket" data-id="${esc(ticket.id)}">Update status</button>`:''}</td></tr>`).join('')||'<tr><td class="empty-state" colspan="7">No ICT requests match this view.</td></tr>'}</tbody></table></div></section>`;
}
function createAsset() {
  if(currentUser.role!=='ICT Officer'&&!isAdmin())return;
  const config=moduleConfig.inventory;
  openModal(config.add,config.fields,'inventory','Add asset',async values=>{
    const asset=await apiRequest('/assets',{method:'POST',body:JSON.stringify({asset_tag:values.assetTag||`ICT-${Date.now()}`,name:values.name,category:values.category,department:values.assigned,custodian:values.custodian,condition:values.condition,status:values.condition==='Needs repair'?'Under repair':'In use',location:values.location})});
    data.assets.unshift({id:asset.id,name:asset.name,tag:asset.asset_tag,category:asset.category,assigned:asset.department,custodian:asset.custodian,condition:asset.condition,status:asset.status,location:asset.location});
  });
}
function openNewTicket() {
  const fields=[['title','Request title','text','Briefly describe the issue'],['category','Request type','select','Hardware|Software|Network access|Access request|Printing|Other'],['priority','Priority','select','Low|Normal|High|Urgent'],['unit','Department unit','select',`${currentUser.unit}|Legal Services|Human Rights|Constitutional Affairs|Administration|ICT Directorate`],['description','Description','textarea','Add relevant details']];
  openModal('New ICT service request',fields,'__ticket__','Submit request',async values=>{
    const ticket=await apiRequest('/tickets',{method:'POST',body:JSON.stringify({title:values.title,category:values.category,priority:values.priority,description:values.description})});
    data.tickets.unshift(uiTicket(ticket));
  });
}
function openFleetEditor(vehicle) {
  const fields=[['mileageKm','Odometer mileage (km)','number',''],['fuelLitresPer100Km','Fuel consumption (L/100 km)','number',''],['location','Current location','text','Town or facility'],['latitude','GPS latitude (if reported)','number','-90 to 90'],['longitude','GPS longitude (if reported)','number','-180 to 180'],['speedKph','Current speed (km/h)','number','0'],['status','Vehicle status','select','Available|On assignment|Maintenance|Out of service']];
  openModal(`Update ${vehicle.registration}`,fields,'__fleet-update__','Save vehicle details',async values=>{
    const updated=await apiRequest(`/fleet/vehicles/${vehicle.id}`,{method:'PATCH',body:JSON.stringify({odometer_km:Number(values.mileageKm),fuel_litres_per_100km:Number(values.fuelLitresPer100Km),current_location:values.location,status:values.status})});
    Object.assign(vehicle,uiVehicle(updated));
    if(values.latitude!==''&&values.longitude!==''){
      await apiRequest(`/fleet/vehicles/${vehicle.id}/locations`,{method:'POST',body:JSON.stringify({latitude:Number(values.latitude),longitude:Number(values.longitude),speed_kph:Number(values.speedKph||0),odometer_km:Number(values.mileageKm)})});
      vehicle.latitude=Number(values.latitude);vehicle.longitude=Number(values.longitude);vehicle.speedKph=Number(values.speedKph||0);vehicle.locationSource='Fleet operator';vehicle.locationUpdatedAt=new Date().toISOString();
    }
  });
  const form=document.getElementById('recordForm');
  form.elements.mileageKm.value=vehicle.mileageKm||0;form.elements.fuelLitresPer100Km.value=vehicle.fuelLitresPer100Km||0;form.elements.location.value=vehicle.location;form.elements.status.value=vehicle.status;
  form.elements.latitude.value=vehicle.latitude??'';form.elements.longitude.value=vehicle.longitude??'';form.elements.speedKph.value=vehicle.speedKph||0;
  form.elements.mileageKm.required=true;form.elements.fuelLitresPer100Km.required=true;
  form.elements.mileageKm.min='0';form.elements.mileageKm.step='1';form.elements.fuelLitresPer100Km.min='0';form.elements.fuelLitresPer100Km.step='0.1';
  form.elements.latitude.min='-90';form.elements.latitude.max='90';form.elements.longitude.min='-180';form.elements.longitude.max='180';form.elements.speedKph.min='0';form.elements.speedKph.max='300';
}
function openNewVehicle() {
  const fields=[['id','Registration number','text','e.g. GOK 123A'],['name','Vehicle make and model','text',''],['unit','Assigned unit','select','Legal Services|Human Rights|Constitutional Affairs|Administration'],['driver','Assigned driver','text',''],['status','Vehicle status','select','Available|On assignment|Maintenance|Out of service'],['mileageKm','Odometer mileage (km)','number','0'],['fuelLitresPer100Km','Fuel consumption (L/100 km)','number','0'],['location','Current location','text',''],['service','Next service date','date','']];
  openModal('Add fleet vehicle',fields,'__fleet-new__','Add vehicle',async values=>{
    const vehicle=await apiRequest('/fleet/vehicles',{method:'POST',body:JSON.stringify({registration:values.id,make_model:values.name,department:values.unit,driver:values.driver,status:values.status,odometer_km:Number(values.mileageKm),fuel_litres_per_100km:Number(values.fuelLitresPer100Km),current_location:values.location,next_service_date:values.service||null})});
    data.vehicles.unshift(uiVehicle(vehicle));
  });
  const form=document.getElementById('recordForm');form.elements.mileageKm.required=true;form.elements.fuelLitresPer100Km.required=true;form.elements.mileageKm.min='0';form.elements.mileageKm.step='1';form.elements.fuelLitresPer100Km.min='0';form.elements.fuelLitresPer100Km.step='0.1';
}
function updateApiRecord(kind,id) {
  const collections={asset:'assets',ticket:'tickets',vehicle:'vehicles',document:'documents'};
  const record=data[collections[kind]]?.find(item=>item.id===id);
  if(!record)return;
  if(kind==='vehicle'){if(fleetCanManage())openFleetEditor(record);return;}
  const map={asset:['condition',['Good','Fair','Needs repair','Retired']],ticket:['status',['Open','In progress','Waiting','Resolved','Closed']],document:['status',['Draft','For review','Approved','Archived']]};
  const [field,states]=map[kind];
  openModal(`Update ${kind} · ${id}`,[[field,`New ${field}`,'select',states.join('|')]],kind,'Apply update',async values=>{
    const path=kind==='asset'?`/assets/${id}`:kind==='ticket'?`/tickets/${id}`:`/documents/${id}`;
    const payload=kind==='document'?{workflow_status:values[field]}:{[field]:values[field]};
    const response=await apiRequest(path,{method:'PATCH',body:JSON.stringify(payload)});
    if(kind==='asset')Object.assign(record,{condition:response.condition,status:response.status,location:response.location,custodian:response.custodian});
    if(kind==='ticket')Object.assign(record,uiTicket(response));
    if(kind==='document')Object.assign(record,uiDocument(response));
  });
  document.querySelector('#recordForm select').value=record[field];
}
updateRow=updateApiRecord;

function bindModalClose(root) {
  root.querySelector('.modal-close')?.addEventListener('click',()=>root.innerHTML='');
  root.querySelector('[data-close]')?.addEventListener('click',()=>root.innerHTML='');
  root.querySelector('[data-dismiss]')?.addEventListener('click',event=>{if(event.target===event.currentTarget)root.innerHTML='';});
}
async function addAttachment(record,kind,file) {
  if(!file)return;
  const allowed=['application/pdf','image/png','image/jpeg','text/plain'];
  if(!allowed.includes(file.type)){toast('Use a PDF, PNG, JPG or plain text file.');return;}
  if(file.size>10*1024*1024){toast('Attachments must be 10 MB or smaller.');return;}
  const form=new FormData();form.append('file',file);
  try {await apiRequest(`/${kind==='memo'?'memos':'documents'}/${record.id}/attachments`,{method:'POST',body:form});if(kind==='memo')await openMemo(record.id);else await openDocument(record.id);toast('Attachment uploaded securely.');}
  catch(error){toast(error.message);}
}
function bindPreviewButtons(root) {
  root.querySelectorAll('[data-preview-kind]').forEach(button=>button.addEventListener('click',async()=>{
    const isMemo=button.dataset.previewKind==='memo';const records=isMemo?data.memos:data.documents;const record=records.find(item=>item.id===button.dataset.recordId);if(!record)return;
    if(isMemo&&!canAccessMemo(record)||!isMemo&&!canAccessDocument(record))return;
    const file=record.attachments.find(item=>item.id===button.dataset.fileId);if(!file)return;
    const response=await fetch(`${apiBase}/attachments/${file.id}/preview`,{headers:{Authorization:`Bearer ${apiToken}`}});
    if(!response.ok){toast('Unable to preview this attachment.');return;}
    const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);
    const preview=file.type==='application/pdf'?`<iframe class="preview-frame" title="${esc(file.name)}" src="${objectUrl}"></iframe>`:file.type.startsWith('image/')?`<img class="preview-image" alt="${esc(file.name)}" src="${objectUrl}">`:`<pre style="white-space:pre-wrap;max-height:65vh;overflow:auto;font:12px/1.6 monospace">${esc(await blob.text())}</pre>`;
    const modal=document.getElementById('modalRoot');modal.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" data-preview-dismiss><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(file.name)}</h2><button class="modal-close" data-preview-close aria-label="Close preview">&times;</button></div><div class="modal-body">${preview}</div></section></div>`);
    const backdrop=modal.querySelector('[data-preview-dismiss]');
    const close=()=>{URL.revokeObjectURL(objectUrl);backdrop.remove();};
    backdrop.querySelector('[data-preview-close]').addEventListener('click',close);backdrop.addEventListener('click',event=>{if(event.target===event.currentTarget)close();});
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
document.getElementById('logoutButton').addEventListener('click',async()=>{try{if(apiToken)await apiRequest('/auth/logout',{method:'POST'});}catch{}apiToken=null;currentUser=null;sessionStorage.removeItem('justice-ops-token');localStorage.removeItem('justice-ops-token');document.getElementById('modalRoot').innerHTML='';render();});

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
    const account=data.accounts.find(item=>item.id===approve.dataset.approveAccount);const role=account&&document.querySelector(`[data-account-role="${CSS.escape(account.id)}"]`)?.value;
    if(account&&role){apiRequest(`/admin/access-requests/${account.id}/approve`,{method:'POST',body:JSON.stringify({role})}).then(async()=>{await loadApiData();render();toast('Account approved and role assigned.');}).catch(error=>toast(error.message));}return;
  }
});

async function restoreApiSession() {
  if(!apiToken){render();return;}
  try {
    currentUser=apiUser(await apiRequest('/auth/me'));
    await loadApiData();
    render();
  } catch(error) {
    apiToken=null;currentUser=null;sessionStorage.removeItem('justice-ops-token');localStorage.removeItem('justice-ops-token');
    renderSignIn('Your session expired. Please sign in again.');
  }
}
restoreApiSession();
setInterval(async()=>{if(currentUser&&currentPage==='tracking'){try{await loadApiData();renderWorkflowApp();}catch{} }},15000);