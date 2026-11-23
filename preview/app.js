const root=document.querySelector('#app');
const api=window.EXIT_CODE_API;
const demo=!api;
const menus=['제출 검수','반별 현황','간식 지급 관리','학생 목록','미션 관리','설정'];
const missionManagementPage=4;
const canOpenHelperPage=(user,index)=>Number.isInteger(index)&&index>=0&&index<menus.length&&(index!==missionManagementPage||user?.id==='helper13');
const icons=['▣','▥','🎁','♟','📖','⚙'];
const glyphs=['🔑','🎲','⚡','⏱','🔐'];
const snackLabels={waiting:'조건 미충족',eligible:'지급 가능',paid:'지급 완료'};
const $=selector=>document.querySelector(selector);
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateFormat=new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'});
const clock=value=>value&&!Number.isNaN(Date.parse(value))?dateFormat.format(new Date(value)):'—';
const status=s=>'<span class="pill '+html(s)+'">'+html(states[s]||snackLabels[s]||s)+'</span>';
const option=(value,name,current)=>'<option value="'+html(value)+'" '+(String(value)===String(current)?'selected':'')+'>'+html(name)+'</option>';
const cmd=(label,action,value='',style='',disabled=false)=>'<button type="button" data-action="'+html(action)+'" data-value="'+html(value)+'" class="'+style+'" '+(disabled?'disabled':'')+'>'+html(label)+'</button>';
const share=record=>shareUrl(record?.url)?'<a class="table-link" target="_blank" rel="noopener noreferrer" href="'+html(record.url)+'" title="'+html(record.url)+'">'+html(record.url)+'</a>':'—';
const table=(heads,body)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+ (body.join('')||'<tr><td colspan="'+heads.length+'">표시할 학생이 없습니다.</td></tr>')+'</tbody></table></div>';
const row=cells=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
const percentage=(count,total)=>total?Math.round(count/total*100):0;
const bar=p=>'<progress max="100" value="'+p+'" aria-label="진행률 '+p+'%"></progress>';
const byNumber=(a,b)=>a.person.number-b.person.number;
let role='student',session=JSON.parse(sessionStorage.getItem('exit-session')||'null');
let page=0, activeMission=3, focusStudent='', data, busy=false, refreshVersion=0, auto=false;
let syncTimer, syncing=false;
let search='',filter='all',sort='number',missionFilter='all';
const chosen=new Set();
let noticeTimer;
function notify(message){
  $('#notice').textContent=message;
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>$('#notice').textContent='',7500);
}
function demoDb(){
  const students=['한하늘','박지훈','이수빈','김서연','최민준','정하은','윤지성','한지우','오예린'].map((name,i)=>({id:'sample-'+i,room:3,number:[12,7,8,4,16,19,21,23,27][i],name}));
  const at=i=>new Date(Date.now()-i*65000).toISOString();
  const submissions=[];
  const progress=[];
  const add=(i,n,state)=>{
    progress.push({student:students[i].id,n,time:at(25+i+n)});
    submissions.push({id:'sample-'+i+'-'+n,student:students[i].id,n,state,url:'',time:at(i+n),actor:state==='pending'?'':'체험 도우미'});
  };
  add(0,1,'done');add(0,2,'done');
  progress.push({student:students[0].id,n:3,time:at(5)});
  [1,2,3].forEach(n=>add(1,n,'done'));
  add(1,4,'pending');add(2,3,'retrying');add(3,3,'pending');add(4,2,'pending');
  [1,2,3].forEach(n=>add(5,n,'done'));
  return {students,submissions,progress,missions:defaultMissions(),snacks:[{student:students[5].id,n:1,state:'paid'}]};
}
async function call(action,args={}){
  const requestSession=session;
  if(demo){
    const key='exit-demo';
    const db=JSON.parse(localStorage.getItem(key)||'null')||demoDb();
    if(action==='login'){
      const user=args.role==='helper'?{role:'helper',id:'체험 도우미',room:3}:{role:'student',...db.students[0]};
      return {token:'demo',user};
    }
    if(action==='logout')return {};
    if(action==='password')throw new Error('비밀번호 변경은 실제 계정에서 사용할 수 있습니다.');
    const runtime={now:new Date().toISOString(),id:()=>crypto.randomUUID(),add:(type,r)=>db[type].push(r),review:(r,state,actor,reviewed)=>Object.assign(r,{state,actor,reviewed})};
    const result=operate(db,session.user,action,args,runtime);
    if(action!=='view')localStorage.setItem(key,JSON.stringify(db));
    return args.includeView===true?{...result,view:operate(db,session.user,'view',{},runtime)}:result;
  }
  let res;
  try{
    const response=await fetch(api,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,args,token:requestSession?.token}),credentials:'omit',signal:AbortSignal.timeout(35000),redirect:'follow'});
    res=await response.json();
  }catch{throw new Error('연결하지 못했습니다. 인터넷 연결과 웹앱 배포 주소를 확인해 주세요.');}
  if(res.code==='SESSION'){if(session===requestSession)endSession();throw new Error(res.message);}
  if(!res.ok)throw new Error(res.message||'요청을 처리하지 못했습니다.');
  return res.data;
}
function endSession(){
  session=null;data=null;auto=false;chosen.clear();focusStudent='';
  clearTimeout(syncTimer);
  sessionStorage.removeItem('exit-session');render();
}
async function refresh({background=false,repaint=true}={}){
  if(!session)return;
  const version=++refreshVersion;
  const currentSession=session;
  const next=await call('view');
  if(session!==currentSession||version!==refreshVersion||(background&&busy))return;
  const previous=data;
  data=next;
  if(repaint&&(!background||JSON.stringify(previous)!==JSON.stringify(next)))render(true);
  if(background&&currentSession.user.role==='student'){
    const before=previous?.views[0]?.missions;
    const updates=next.views[0]?.missions.filter((m,i)=>before?.[i]&&before[i].state!==m.state&&['done','retrying'].includes(m.state));
    if(updates?.length)notify(updates.map(m=>'미션 '+m.n+' · '+states[m.state]).join('\n'));
  }
}
function scheduleSync(delay){
  clearTimeout(syncTimer);
  if(document.hidden||!session||(session.user.role==='helper'&&!auto))return;
  const pending=data?.views[0]?.missions.some(m=>m.state==='pending');
  syncTimer=setTimeout(sync,delay??(session.user.role==='helper'?30000:pending?3000:20000));
}
async function sync(){
  if(document.hidden||!session)return;
  if(busy||syncing){scheduleSync(1000);return;}
  if(session.user.role==='helper'&&(!auto||focusStudent||root.querySelector('form :focus'))){scheduleSync();return;}
  syncing=true;
  let retry;
  try{await refresh({background:true});}
  catch(error){if(!session)notify(error.message);retry=30000;}
  finally{syncing=false;scheduleSync(retry);}
}
function login(){
  return '<section class="login"><h1>코딩 미션 챌린지</h1><div class="toolbar">'+cmd('🎮 학생 모드','role','student',role==='student'?'active':'')+cmd('🛡 코딩 도우미','role','helper',role==='helper'?'active':'')+'</div>'+
    (demo?'<p>체험 모드입니다. 가상 학생 정보와 제출 기록을 사용합니다.</p>':'')+
    '<form data-form="login">'+(demo?'':role==='student'?'<label>반<select name="room" required>'+[1,2,3,4,5].map(n=>option(n,n+'반',1)).join('')+'</select></label><label>번호<input name="number" type="number" min="1" max="99" required></label><label>이름<input name="name" maxlength="30" autocomplete="name" required></label>':'<label>도우미 ID<input name="id" autocomplete="username" required></label><label>비밀번호<input type="password" name="password" autocomplete="current-password" required></label>')+
    '<button class="primary">'+(demo?'체험 시작':'로그인')+'</button></form></section>';
}
function identity(title,extra='',showRefresh=true){
  return '<div class="identity"><strong>'+html(title)+(demo?' · 체험':'')+'</strong>'+extra+'<div class="actions">'+(showRefresh?cmd('↻ 새로고침','refresh'):'')+cmd('로그아웃','logout')+'</div></div>';
}
function student(){
  const view=data.views[0];
  if(!view)return '<p class="panel">학생 정보를 찾을 수 없습니다.</p>';
  const person=view.person;
  const done=view.missions.filter(m=>m.state==='done').length;
  const current=view.missions[activeMission-1];
  const m=data.missions.find(m=>m.n===activeMission)||{};
  const locked=current.state==='locked';
  const ready=current.state==='ready';
  const canSubmit=['started','retrying'].includes(current.state);
  const art=/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(m.image||'')?'<img width="100" height="100" style="object-fit:contain" src="'+html(m.image)+'" alt="">':'';
  const stageList=view.missions.map(item=>{
    const title=data.missions.find(x=>x.n===item.n)?.title||'미션 준비 중';
    const stageClass=['stage',item.n===activeMission?'selected':'',item.state==='done'?'complete':'',['started','retrying'].includes(item.state)?'in-challenge':''].join(' ');
    return '<button type="button" class="'+stageClass+'" data-action="stage" data-value="'+item.n+'" aria-pressed="'+(item.n===activeMission)+'"><span class="glyph" aria-hidden="true">'+(item.state==='locked'?'🔒':item.state==='done'?'✅':glyphs[item.n-1])+'</span><strong>미션 '+item.n+'</strong><small class="title">'+html(title)+'</small>'+status(item.state)+'</button>';
  }).join('<span class="stage-arrow" aria-hidden="true">›</span>');
  return identity(person.room+'반 '+person.number+'번 '+person.name,'<span>전체 진행률 '+done+' / 5 &nbsp; '+bar(done*20)+'</span>',false)+
    '<nav class="stages" aria-label="미션 선택">'+stageList+'</nav><div class="student-grid"><section class="panel"><div class="toolbar"><span class="pill mission-tag">미션 '+activeMission+'</span><span class="pill">'+html(m.level||states[current.state])+'</span></div><h1>'+html(m.title||'미션 준비 중')+'</h1>'+
    (locked?'<p>🔒 '+(activeMission===4?'미션 1·2·3 승인을 모두 받으면 열립니다.':activeMission===5?'미션 4를 승인받으면 열립니다.':'현재 사용할 수 없는 미션입니다.')+'</p>':ready?'<p>도전을 시작하면 문제와 힌트를 볼 수 있어요.</p>'+cmd('도전 시작','start',activeMission,'primary'):art+'<p class="narrative">'+html(m.problem)+'</p><div class="conditions"><h3>◎ 성공 조건</h3>'+html(m.conditions)+'</div><p class="muted">필요 블록 · '+html(m.blocks)+'</p><a class="button primary" target="_blank" rel="noopener noreferrer" href="https://makecode.microbit.org/">MakeCode 열기</a>')+
    '</section><section class="panel"><h2>💡 힌트</h2>'+(locked||ready?'<p class="muted">도전 중인 미션에서 힌트를 볼 수 있어요.</p>':'<details class="hint" id="hint1"><summary>힌트 1</summary><p>'+html(m.hint1)+'</p></details><details class="hint" id="hint2" hidden><summary>힌트 2</summary><p>'+html(m.hint2)+'</p></details>')+
    '</section><div class="stack"><section class="panel"><h2>🔗 코드 제출</h2><form class="stack submission" data-form="submit"><label>MakeCode 공유 URL<input type="url" name="url" required placeholder="https://makecode.microbit.org/…" '+(canSubmit?'':'disabled')+'></label><button class="primary" '+(canSubmit?'':'disabled')+'>제출하기</button></form>'+
    (!canSubmit?'<p class="submission-state">'+(ready?'도전 시작 후 제출할 수 있어요.':status(current.state))+'</p>':'')+
    (current.record?'<div>'+share(current.record)+'</div>':'')+'</section><section class="panel"><h2>🎁 내 간식 현황</h2><ul class="student-rewards">'+view.snacks.map(s=>'<li class="reward-card '+html(s.state)+'"><span class="reward-gift" aria-hidden="true">🎁</span><strong>'+s.n+'차 간식</strong>'+status(s.state)+'</li>').join('')+'</ul></section></div></div>';
}
function snacks(view,interactive){
  return '<div class="snacks">'+view.snacks.map(s=>'<div class="snack"><span>'+s.n+'차 간식</span>'+status(s.state)+(interactive&&s.state!=='waiting'?cmd(s.state==='paid'?'지급 취소':'지급 완료','snack',JSON.stringify([view.person.id,s.n,s.state==='paid']),s.state==='paid'?'danger':'approve'):'')+'</div>').join('')+'</div>';
}
function reviewButtons(m){
  if(!m.record)return '—';
  if(m.state==='pending')return cmd('✓ 승인','review',JSON.stringify([m.record.id,'done']),'approve')+' '+cmd('↻ 재도전','review',JSON.stringify([m.record.id,'retrying']),'retry');
  if(m.state==='done')return cmd('승인 취소','review',JSON.stringify([m.record.id,'revoke']),'danger');
  return '—';
}
function reviewPage(all){
  const rank={pending:0,retrying:1,started:2,ready:3,done:4,locked:5};
  const rows=all.map(v=>{
    const fallback=miss=>miss.find(m=>m.state==='pending')||miss.find(m=>m.state==='retrying')||miss.find(m=>m.state==='started')||miss.find(m=>m.state==='ready')||[...miss].reverse().find(m=>m.state==='done')||miss[0];
    return {...v,m:missionFilter==='all'?fallback(v.missions):v.missions[Number(missionFilter)-1]};
  }).filter(v=>(filter==='all'||v.m.state===filter)&&matches(v));
  rows.sort((a,b)=>({
    mission:()=>a.m.n-b.m.n,
    review:()=>rank[a.m.state]-rank[b.m.state]||String(a.m.record?.time||'').localeCompare(b.m.record?.time||''),
    recent:()=>String(b.m.record?.time||'').localeCompare(a.m.record?.time||''),
    number:()=>0
  }[sort]()||byNumber(a,b)));
  const visible=rows.filter(v=>v.m.state==='pending'&&v.m.record);
  const pending=new Set(all.flatMap(v=>v.missions.filter(m=>m.state==='pending').map(m=>m.record?.id)));
  for(const id of chosen)if(!pending.has(id))chosen.delete(id);
  return '<div class="toolbar"><strong>미션</strong>'+['all',1,2,3,4,5].map(n=>cmd(n==='all'?'전체':'미션 '+n,'missionFilter',n,String(missionFilter)===String(n)?'active':'')).join('')+'</div>'+
    '<div class="toolbar">'+[['number','번호순'],['mission','미션순'],['review','검수순'],['recent','최근 제출순']].map(([v,t])=>cmd(t,'sort',v,sort===v?'active':'')).join('')+'</div>'+
    '<div class="toolbar"><label class="inline">상태 <select id="filter">'+option('all','전체',filter)+Object.entries(states).map(([v,t])=>option(v,t,filter)).join('')+'</select></label>'+searchBox()+'</div>'+
    '<div class="review-list">'+table(['<input type="checkbox" id="selectAll" aria-label="표시된 대기 항목 모두 선택" '+(visible.length&&visible.every(v=>chosen.has(v.m.record.id))?'checked':'')+(!visible.length?' disabled':'')+'>','번호','이름','미션','제출한 코드 (MakeCode URL)','제출 시간','상태','검수 처리','간식 지급'],rows.map(v=>row([
      v.m.state==='pending'&&v.m.record?'<input type="checkbox" data-select="'+html(v.m.record.id)+'" aria-label="'+html(v.person.name)+' 제출 선택" '+(chosen.has(v.m.record.id)?'checked':'')+'>':'—',
      v.person.number,cmd(v.person.name,'detail',v.person.id),'<span class="pill mission-tag mission-'+v.m.n+'">미션 '+v.m.n+'</span>',share(v.m.record),clock(v.m.record?.time),status(v.m.state),reviewButtons(v.m),v.snacks.filter(s=>s.state==='paid').length+' / 3'
    ])))+'</div><div class="section-title"><div class="actions">선택 '+chosen.size+'건 '+cmd('✓ 선택 승인','bulk','done','approve',!chosen.size)+cmd('↻ 선택 재도전','bulk','retrying','retry',!chosen.size)+'</div><span>'+rows.length+'명 표시</span></div>';
}
function searchBox(){return '<label class="inline">학생 검색 <input id="search" type="search" placeholder="번호 또는 이름" value="'+html(search)+'"></label>';}
function matches(v){return String(v.person.number).includes(search.trim())||v.person.name.includes(search.trim());}
function summary(all){
  const count=state=>all.filter(v=>v.missions.some(m=>m.state===state)).length;
  const groups=[all.length,count('started'),count('pending'),count('retrying'),all.filter(v=>v.missions.slice(0,3).every(m=>m.state==='done')).length,all.filter(v=>v.missions[3].state==='done').length,all.filter(v=>v.missions[4].state==='done').length];
  return '<div class="toolbar">'+['전체 학생','도전 중','검수 대기','재도전','미션 1~3 완료','미션 4 완료','미션 5 완료'].map((s,i)=>'<span class="pill">'+s+' '+groups[i]+'명</span>').join('')+'</div>'+
    table(['미션',...Object.values(states),'완료율'],[1,2,3,4,5].map(n=>{
      const counts=Object.keys(states).map(s=>all.filter(v=>v.missions[n-1].state===s).length);
      const pct=percentage(counts.at(-1),all.length);
      return row([cmd('미션 '+n,'inspect',n),...counts,pct+'% '+bar(pct)]);
    }));
}
function latestActivity(v){
  return clock([...v.missions.flatMap(m=>[m.started,m.record?.time,m.record?.reviewed])].filter(Boolean).sort().at(-1));
}
function helper(){
  if(!canOpenHelperPage(data.user,page))page=0;
  const all=[...data.views].sort(byNumber);
  const count=s=>all.reduce((sum,v)=>sum+v.missions.filter(m=>m.state===s).length,0);
  const done=count('done'),paid=all.reduce((sum,v)=>sum+v.snacks.filter(s=>s.state==='paid').length,0);
  const pct=percentage(done,all.length*5);
  const stats=['◷ 검수 대기','✓ 승인 완료','↻ 재도전 요청','🎁 지급 완료','▥ 반 진행률'].map((label,i)=>'<div class="stat">'+label+'<strong>'+[count('pending'),done,count('retrying'),paid,pct+'%'][i]+'</strong>'+(i===4?bar(pct):'')+'</div>').join('');
  const pages=[
    ()=>reviewPage(all),
    ()=>summary(all),
    ()=>'<div class="toolbar">'+searchBox()+'<label class="inline">지급 상태 <select id="filter">'+option('all','전체',filter)+Object.entries(snackLabels).map(([v,t])=>option(v,t,filter)).join('')+'</select></label></div>'+
    table(['번호','이름','미션 완료','간식 지급'],all.filter(v=>matches(v)&&(filter==='all'||v.snacks.some(s=>s.state===filter))).map(v=>row([v.person.number,cmd(v.person.name,'detail',v.person.id),v.missions.filter(m=>m.state==='done').map(m=>m.n).join(' · ')||'—',snacks(v,true)]))),
    ()=>searchBox()+table(['반','번호','이름','학생 ID','진행 중','완료','최종 활동'],all.filter(matches).map(v=>row([v.person.room,v.person.number,cmd(v.person.name,'detail',v.person.id),html(v.person.id),v.missions.filter(m=>['started','pending','retrying'].includes(m.state)).map(m=>m.n).join(' · ')||'—',v.missions.filter(m=>m.state==='done').length+' / 5',latestActivity(v)]))),
    ()=>data.missions.map(m=>'<details class="hint"><summary>미션 '+m.n+' · '+html(m.title)+' · '+(m.enabled?'사용':'미사용')+'</summary><p>'+html(m.level)+' · '+html(m.problem)+'</p><p>'+html(m.conditions)+'</p><p>힌트 1 · '+html(m.hint1)+'</p><p>힌트 2 · '+html(m.hint2)+'</p><p>필요 블록 · '+html(m.blocks)+'</p></details>').join(''),
    ()=>'<p>'+html(session.user.id)+' · '+session.user.room+'반</p><p>세션이 만료되면 다시 로그인해 주세요.</p><form class="stack" data-form="password"><label>현재 비밀번호<input name="old" type="password" maxlength="128" autocomplete="current-password" required></label><label>새 비밀번호<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><button class="primary">비밀번호 변경</button></form>'
  ];
  const v=all.find(x=>x.person.id===focusStudent);
  return identity(data.user.room+'반 · '+data.user.id,'<label class="inline"><input type="checkbox" id="auto" '+(auto?'checked':'')+'>자동 갱신 (30초)</label>')+
    '<div class="dashboard"><nav class="sidebar" aria-label="도우미 메뉴"><h2>코딩 도우미</h2>'+menus.map((n,i)=>canOpenHelperPage(data.user,i)?cmd(icons[i]+' '+n,'menu',i,page===i?'active':''):'').join('')+'</nav><section class="panel"><div class="section-title"><h2>'+menus[page]+'</h2></div><div class="stats">'+stats+'</div>'+pages[page]()+'</section></div>'+
    (v?'<dialog id="student-detail"><div class="section-title"><h2>'+v.person.room+'반 '+v.person.number+'번 '+html(v.person.name)+'</h2>'+cmd('닫기','close')+'</div>'+
    table(['미션','상태','시작 시간','제출 시간','공유 링크','검수'],v.missions.map(m=>row([m.n,status(m.state),clock(m.started),clock(m.record?.time),share(m.record),reviewButtons(m)])))+
    '<h3>제출 및 검수 기록</h3>'+table(['미션','제출 시간','코드','검수 결과','검수자','검수 시간'],[...v.records].reverse().map(r=>row([r.n,clock(r.time),share(r),status(r.state),html(r.actor||'—'),clock(r.reviewed)])))+
    (v.records.some(r=>r.history?.length)?'<h3>검수 변경 이력</h3>'+table(['미션','처리','이전 상태','변경 상태','처리자','시간'],v.records.flatMap(r=>(r.history||[]).map(h=>row([r.n,html(h[2]),status(h[3]),status(h[4]),html(h[5]),clock(h[6])])))):'')+
    '<h3>간식 지급</h3>'+snacks(v,true)+'</dialog>':'');
}
function render(preserve=false){
  const previous=$('#search');
  const hadFocus=previous&&document.activeElement===previous;
  const cursor=hadFocus?previous.selectionStart:null;
  const opened=preserve&&$('#hint1')?.open;
  const second=preserve&&$('#hint2')?.open;
  const unlocked=preserve&&$('#hint2')?.hidden===false;
  const url=preserve&&$('.submission input');
  const urlWasFocused=url&&document.activeElement===url;
  const stage=preserve&&document.activeElement?.closest('.stage');
  document.body.classList.toggle('helper',(session?.user?.role||role)==='helper');
  document.body.classList.toggle('student-view',Boolean(data&&session?.user.role==='student'));
  root.innerHTML=!session?login():!data?'<p class="panel">불러오는 중… '+cmd('다시 불러오기','refresh')+' '+cmd('로그아웃','logout')+'</p>':session.user.role==='helper'?helper():student();
  if(hadFocus&&$('#search')){$('#search').focus();$('#search').setSelectionRange(cursor,cursor);}
  const nextUrl=$('.submission input');
  if(url&&nextUrl&&!nextUrl.disabled){
    nextUrl.value=url.value;
    if(urlWasFocused)nextUrl.focus({preventScroll:true});
  }
  if(stage)root.querySelector('.stage[data-value="'+stage.dataset.value+'"]')?.focus({preventScroll:true});
  if($('#hint1'))$('#hint1').open=Boolean(opened);
  if($('#hint2')){$('#hint2').hidden=!unlocked;$('#hint2').open=Boolean(second);}
  $('#hint1')?.addEventListener('toggle',e=>{if(e.target.open&&$('#hint2'))$('#hint2').hidden=false;});
  const dialog=$('#student-detail');
  if(dialog){dialog.showModal();dialog.addEventListener('cancel',()=>{focusStudent='';});}
}
async function task(fn){
  if(busy)return;
  busy=true;
  try{await fn();}catch(error){notify(error.message);}finally{busy=false;scheduleSync();}
}
async function save(action,args){
  const currentSession=session;
  const result=await call(action,{...args,includeView:true});
  if(session!==currentSession)return;
  const input=$('.submission input');
  if(action==='submit'&&input&&activeMission===args.n)input.value='';
  let refreshFailed=false;
  if(result.view){
    ++refreshVersion;
    data=result.view;
    render(true);
  }else{
    try{await refresh();}
    catch(error){if(session!==currentSession)throw error;refreshFailed=true;}
  }
  const suffix=refreshFailed?' 화면 갱신에 실패했습니다. 잠시 뒤 다시 확인해 주세요.':'';
  if(result.results){
    const failed=result.results.filter(r=>!r.ok);
    notify('처리 '+(result.results.length-failed.length)+'건 · 실패 '+failed.length+'건'+suffix+(failed.length?'\n'+[...new Set(failed.map(r=>r.message))].join('\n'):''));
    return;
  }
  notify((action==='submit'?'코드를 제출했습니다. 도우미 검수를 기다려 주세요.':'저장했습니다.')+suffix);
}
root.addEventListener('click',e=>{
  const item=e.target.closest('button[data-action]');
  if(!item)return;
  const {action,value}=item.dataset;
  const local={
    role:()=>{role=value;},stage:()=>{activeMission=Number(value);},menu:()=>{
      const next=Number(value);
      if(!canOpenHelperPage(data?.user,next))return;
      page=next;filter='all';search='';
    },
    detail:()=>{focusStudent=value;},close:()=>{focusStudent='';},sort:()=>{sort=value;},
    missionFilter:()=>{missionFilter=value;},inspect:()=>{page=0;missionFilter=value;filter='all';search='';}
  };
  if(local[action]){local[action]();render();return;}
  task(async()=>{
    if(action==='refresh'){await refresh();notify('새로고침했습니다.');}
    if(action==='logout'){await call('logout');endSession();}
    if(action==='start')await save('start',{n:Number(value)});
    if(action==='review'){
      const [id,result]=JSON.parse(value);
      if(result==='revoke'&&!confirm('이 미션의 승인을 취소할까요?'))return;
      await save('review',{ids:[id],result});
    }
    if(action==='bulk'){
      if(!confirm('선택한 '+chosen.size+'건의 코드를 모두 확인했나요? '+(value==='done'?'선택 승인':'선택 재도전')+'을 진행합니다.'))return;
      await save('review',{ids:[...chosen],result:value});
    }
    if(action==='snack'){
      const [student,n,cancel]=JSON.parse(value);
      if(confirm(n+'차 간식을 '+(cancel?'지급 취소할까요?':'지급 완료로 기록할까요?')))await save('snack',{student,n,cancel});
    }
  });
});
root.addEventListener('input',e=>{if(e.target.id==='search'){search=e.target.value;render();}});
root.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='auto'){auto=t.checked;scheduleSync();return;}
  if(t.id==='filter')filter=t.value;
  else if(t.id==='selectAll')root.querySelectorAll('[data-select]').forEach(x=>t.checked?chosen.add(x.dataset.select):chosen.delete(x.dataset.select));
  else if(t.dataset.select)t.checked?chosen.add(t.dataset.select):chosen.delete(t.dataset.select);
  else return;
  render();
});
root.addEventListener('submit',e=>{
  e.preventDefault();
  const fields=Object.fromEntries(new FormData(e.target));
  const button=e.target.querySelector('button');
  task(async()=>{
    button.disabled=true;
    try{
      if(e.target.dataset.form==='login'){
        session=await call('login',{...fields,role});
        sessionStorage.setItem('exit-session',JSON.stringify(session));
        page=0;search='';filter='all';sort='number';missionFilter='all';
        render();
        await refresh({repaint:false});
        activeMission=demo?3:(data?.views[0]?.missions.find(m=>m.state==='started')?.n||1);
        render();
      }
      if(e.target.dataset.form==='submit')await save('submit',{n:activeMission,url:fields.url});
      if(e.target.dataset.form==='password'){await call('password',fields);endSession();notify('비밀번호를 변경했습니다. 다시 로그인해 주세요.');}
    }finally{button.disabled=false;}
  });
});
document.addEventListener('visibilitychange',()=>scheduleSync(0));
window.addEventListener('online',()=>scheduleSync(0));
if(demo)window.addEventListener('storage',e=>{if(e.key==='exit-demo'&&session?.user.role==='student')scheduleSync(0);});
render();
if(session)task(()=>refresh());

