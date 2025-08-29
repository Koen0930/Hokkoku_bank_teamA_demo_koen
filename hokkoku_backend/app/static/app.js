const sessionIdInput = document.getElementById('sessionId');
const btnCreateSession = document.getElementById('btnCreateSession');
const sessionStatus = document.getElementById('sessionStatus');
const modeSel = document.getElementById('mode');
const btnSend = document.getElementById('btnSend');
const contentEl = document.getElementById('content');
const chat = document.getElementById('chat');
const constraintsEl = document.getElementById('constraints');
const btnValidate = document.getElementById('btnValidate');
const btnApply = document.getElementById('btnApply');
const validateResult = document.getElementById('validateResult');
const logEl = document.getElementById('log');
const btnClear = document.getElementById('btnClear');

function log(s){ logEl.textContent += s + "\n"; logEl.scrollTop = logEl.scrollHeight; }
function bubble(role, text){ const b=document.createElement('div'); b.className='bubble '+role; b.textContent=text; chat.appendChild(b); chat.scrollTop=chat.scrollHeight; }

async function createSession(){
  btnCreateSession.disabled = true;
  try{
    const res = await fetch('/api/llm/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'demo'})});
    if(!res.ok){ throw new Error(await res.text()); }
    const js = await res.json();
    sessionIdInput.value = js.session_id;
    sessionStatus.textContent = '作成済';
    log('session created: '+js.session_id);
  }catch(e){ log('createSession error: '+e); }
  finally{ btnCreateSession.disabled = false; }
}

async function sendMessage(){
  const sid = sessionIdInput.value.trim();
  if(!sid){ alert('session_id を先に作成してください'); return; }
  const mode = modeSel.value;
  const content = contentEl.value.trim();
  if(!content){ return; }
  bubble('user', content);
  btnSend.disabled = true;
  try{
    const res = await fetch(`/api/llm/sessions/${encodeURIComponent(sid)}/messages`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({content, mode})
    });
    const txt = await res.text();
    if(!res.ok){ bubble('assistant', `エラー: ${txt}`); log('send error: '+txt); return; }
    const js = JSON.parse(txt);
    if(js.intent==='qa'){
      bubble('assistant', js.assistant_text||'(no text)');
    }else{
      let t = (js.assistant_text||'') + '\n';
      t += 'validation: ' + (js.validation&&js.validation.ok ? 'OK' : 'NG') + '\n';
      if(js.diff_summary){ t += 'diff: '+JSON.stringify(js.diff_summary); }
      bubble('assistant', t);
      if(js.draft_constraints){ constraintsEl.value = JSON.stringify(js.draft_constraints, null, 2); }
    }
  }catch(e){ bubble('assistant', '通信エラー'); log('sendMessage error: '+e); }
  finally{ btnSend.disabled = false; }
}

async function validateConstraints(){
  validateResult.textContent = '';
  try{
    const body = { constraints_json: JSON.parse(constraintsEl.value) };
    const res = await fetch('/api/constraints/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const js = await res.json();
    if(js.ok){
      validateResult.innerHTML = '<span class="ok">OK</span>';
    }else{
      validateResult.innerHTML = '<span class="err">NG</span> ' + JSON.stringify(js.errors);
    }
  }catch(e){ validateResult.textContent = 'エラー'; log('validate error: '+e); }
}

async function applyConstraints(){
  try{
    const body = { constraints_json: JSON.parse(constraintsEl.value), apply_mode:'immediate' };
    const res = await fetch('/api/constraints/apply',{method:'POST',headers:{'Content-Type':'application/json','X-Role':'admin'},body:JSON.stringify(body)});
    const js = await res.json();
    if(res.ok){
      log('applied: version='+js.version_id+' at '+js.applied_at);
    }else{
      log('apply error: '+JSON.stringify(js));
    }
  }catch(e){ log('apply error: '+e); }
}

btnCreateSession.addEventListener('click', createSession);
btnSend.addEventListener('click', sendMessage);
btnValidate.addEventListener('click', validateConstraints);
btnApply.addEventListener('click', applyConstraints);
btnClear.addEventListener('click', ()=>{ logEl.textContent=''; });

async function refreshMode(){
  try{
    const res = await fetch('/api/config');
    if(res.ok){
      const js = await res.json();
      const label = document.getElementById('modeLabel');
      if(label){
        label.textContent = js.mode === 'mock' ? '(Mock モード)' : '(Real LLM モード)';
      }
    }
  }catch(e){ /* ignore */ }
}

window.addEventListener('load', ()=>{ log('ready'); refreshMode(); });
