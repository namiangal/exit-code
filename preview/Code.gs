const states = {locked:'잠김',ready:'도전 전',started:'도전 중',pending:'검수 대기',retrying:'재도전 요청',done:'승인 완료'};
const stages = [
  ['비밀번호 입력하기','기초','버튼으로 숫자를 바꾸고 비밀번호를 확인하세요.','숫자 5에서 확인하면 성공을 표시하세요.','입력한 숫자를 변수에 저장하세요.','확인 버튼을 누르면 입력값이 5인지 비교하세요.','변수, 버튼, 조건문'],
  ['행운의 암호 찾기','기초','흔들어 1부터 6 사이의 행운의 숫자를 뽑으세요.','뽑은 숫자를 표시하고 3이면 성공을 표시하세요.','흔들기 이벤트를 사용하세요.','무작위로 뽑은 숫자를 변수에 담아 비교하세요.','흔들기, 무작위 수, 조건문'],
  ['탈출 기회는 3번','응용','탈출 버튼을 누를 기회는 세 번입니다. 제한된 기회 안에 암호를 확인하세요.','기회는 3에서 시작합니다.\n확인할 때마다 1씩 줄어듭니다.\n기회가 0이면 추가 입력을 막습니다.\n암호가 맞으면 성공을 표시합니다.','남은 기회를 저장할 변수를 만들고 3으로 시작하세요.','확인 버튼을 눌렀을 때 남은 기회가 0보다 큰지 먼저 확인하세요.','변수, 버튼, 조건문'],
  ['5초 안에 탈출하기','응용','시작 버튼을 누른 뒤 5초 이내에 탈출 버튼을 누르세요.','5초 이내에는 성공, 시간이 지나면 실패를 표시하세요.','시작한 시각을 변수에 저장하세요.','현재 실행 시간에서 시작 시각을 빼 보세요.','버튼, 실행 시간, 조건문'],
  ['비밀 버튼 순서 찾기','도전','비밀 순서 A → B → A를 감지하는 장치를 만드세요.','올바른 순서면 성공을 표시하고, 틀리면 첫 단계로 돌아가세요.','지금 몇 번째 입력을 기다리는지 변수로 기록하세요.','기다리는 버튼이 맞으면 단계 값을 하나 올려 보세요.','버튼, 변수, 조건문']
];
const defaultMissions = () => stages.map(([title,level,problem,conditions,hint1,hint2,blocks],i)=>({n:i+1,title,level,problem,conditions,hint1,hint2,blocks,image:'',enabled:true}));
const shareUrl = value => {
  const url = String(value || '').trim();
  return /^https:\/\/makecode\.microbit\.org\/(?:_[A-Za-z0-9]{6,32}|(?:S)?\d{5}(?:-\d{5}){3})\/?$/.test(url) ? url : '';
};
const normalizeNo = value => Number(String(value).trim().replace(/(?:반|번)$/,''));
const latest = (items, n) => items.filter(r=>r.n===n).reduce((last,r)=>!last || r.time>=last.time ? r : last,null);
function studentView(db, person) {
  const records = db.submissions.filter(r=>r.student===person.id);
  const progress = db.progress.filter(r=>r.student===person.id);
  const missions = [1,2,3,4,5].map(n=>{
    const record = latest(records,n);
    const started = progress.find(r=>r.n===n)?.time || '';
    return {n,state:record?.state || (started?'started':'ready'),record,started};
  });
  const first = missions.slice(0,3).every(m=>m.state==='done');
  const allowed = missions.map((m,i)=>Boolean(db.missions.find(x=>x.n===m.n)?.enabled && (i<3 || (first && (i===3 || missions[3].state==='done')))));
  const snacks = [first,first && missions[3].state==='done',first && missions[3].state==='done' && missions[4].state==='done'].map((eligible,i)=>{
    const last = db.snacks.filter(r=>r.student===person.id && r.n===i+1).at(-1);
    return {n:i+1,state:last?.state==='paid'?'paid':eligible?'eligible':'waiting'};
  });
  missions.forEach((m,i)=>{if(!allowed[i] && m.state!=='done')m.state='locked';});
  return {person,missions,snacks,records};
}
function operate(db, user, action, args, runtime) {
  const fail = message => {throw new Error(message);};
  const helper = user.role==='helper';
  const roster = db.students.filter(p=>helper?p.room===user.room:p.id===user.id);
  const owns = id => roster.find(p=>p.id===id) || fail('접근할 수 없는 학생입니다.');
  const time = runtime.now;
  const mission = Number(args.n);
  if(action==='view'){
    const views=roster.map(p=>studentView(db,p));
    const missions=helper?db.missions:db.missions.map(m=>!m.enabled || ['locked','ready'].includes(views[0]?.missions[m.n-1]?.state)?{n:m.n,title:m.title,level:m.level,enabled:m.enabled}:m);
    return {user,missions,views};
  }
  if(!helper && (action==='start'||action==='submit')){
    const view=studentView(db,owns(user.id));
    const m=view.missions.find(x=>x.n===mission);
    if(!m || !['ready','started','retrying'].includes(m.state))fail('이 미션은 현재 시작하거나 제출할 수 없습니다.');
    if(action==='start'){
      if(!m.started)runtime.add('progress',{student:user.id,n:mission,time});
      return {};
    }
    if(m.state==='ready')fail('도전 시작 버튼을 먼저 눌러 주세요.');
    const url=shareUrl(args.url);
    if(!url)fail('MakeCode의 올바른 공유 링크를 입력해 주세요.');
    runtime.add('submissions',{id:runtime.id(),student:user.id,n:mission,url,time,state:'pending',previous:m.record?.id||''});
    return {};
  }
  if(!helper)fail('도우미만 처리할 수 있습니다.');
  if(action==='review'){
    const targets=Array.isArray(args.ids)?[...new Set(args.ids)]:[];
    if(!targets.length || targets.length>150 || !['done','retrying','revoke'].includes(args.result))fail('검수할 항목을 확인해 주세요.');
    if(args.result==='revoke' && targets.length!==1)fail('승인 취소는 한 건씩 처리해 주세요.');
    return {results:targets.map(id=>{
      try {
        const record=db.submissions.find(r=>r.id===id);
        if(!record)fail('제출 기록을 찾을 수 없습니다.');
        const view=studentView(db,owns(record.student));
        const current=view.missions[record.n-1];
        if(!current || current.record?.id!==id || current.state!==(args.result==='revoke'?'done':'pending'))fail('상태가 바뀌었습니다. 새로고침해 주세요.');
        if(args.result==='revoke'){
          const blocked=record.n<=3?[4,5]:record.n===4?[5]:[];
          if(view.missions.some(m=>blocked.includes(m.n)&&(m.started||m.record)))fail('후속 미션 활동이 있어 취소할 수 없습니다.');
          if(view.snacks[record.n<=3?0:record.n-3].state==='paid')fail('해당 간식 지급을 먼저 취소해 주세요.');
        }
        const state=args.result==='revoke'?'retrying':args.result;
        runtime.review(record,state,user.id,time);
        return {id,ok:true};
      } catch(error){return {id,ok:false,message:error.message};}
    })};
  }
  if(action==='snack'){
    const view=studentView(db,owns(args.student));
    const snack=view.snacks.find(s=>s.n===mission);
    if(!snack || (args.cancel===true?snack.state!=='paid':snack.state!=='eligible'))fail('현재 간식 상태에서는 처리할 수 없습니다.');
    runtime.add('snacks',{student:args.student,n:mission,state:args.cancel===true?'cancelled':'paid',time,actor:user.id});
    return {};
  }
  fail('지원하지 않는 요청입니다.');
}

const headers = {
  학생명단:['학생ID','반','번호','이름','역할'],
  도우미계정:['계정ID','담당반','사용여부','비밀번호해시','권한','솔트','비밀번호해시V2'],
  미션정보:['미션번호','미션제목','난이도','문제','성공조건','힌트1','힌트2','필요블록','이미지','사용여부'],
  미션진행:['학생ID','미션번호','시작시간','최종활동시간','진행상태'],
  미션제출:['제출ID','학생ID','미션번호','MakeCode URL','제출시간','검수상태','검수자','검수시간','최종수정시간','최종수정자','이전제출ID','검수이력JSON'],
  검수이력:['이력ID','제출ID','처리종류','이전상태','변경상태','처리자','처리시간'],
  간식지급:['학생ID','지급상태','지급시간','지급확인자','최종수정시간','최종수정자','미션단계'],
  차수간식이력:['학생ID','지급차수','지급상태','처리시간','처리자']
};
const props = () => PropertiesService.getScriptProperties();
const spreadsheet = () => SpreadsheetApp.openById(props().getProperty('SPREADSHEET_ID'));
const escapeCell = value => typeof value==='string' && /^[=+\-@']/.test(value) ? "'"+value : value;
const randomKey = () => (Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
function onOpen(){
  SpreadsheetApp.getUi().createMenu('EXIT CODE').addItem('시트 초기 설정','setup').addItem('도우미 계정 등록·재설정','setHelper').addToUi();
}
function setup(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('Google Sheets에서 확장 프로그램 → Apps Script로 스크립트를 열어 주세요.');
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const store=props();
    const previous=store.getProperty('SPREADSHEET_ID');
    if(previous && previous!==ss.getId())throw new Error('프로젝트가 다른 스프레드시트에 연결되어 있습니다.');
    store.setProperty('SPREADSHEET_ID',ss.getId());
    if(!store.getProperty('PEPPER'))store.setProperty('PEPPER',randomKey());
    for(const [name,cols] of Object.entries(headers)){
      const s=ss.getSheetByName(name)||ss.insertSheet(name);
      const current=s.getLastColumn()?s.getRange(1,1,1,s.getLastColumn()).getDisplayValues()[0]:[];
      const missing=cols.filter(h=>!current.includes(h));
      if(missing.length)s.getRange(1,current.length+1,1,missing.length).setValues([missing]);
      s.setFrozenRows(1);
    }
    if(ss.getSheetByName('미션정보').getLastRow()===1){
      defaultMissions().forEach(m=>append(ss,'미션정보',[m.n,m.title,m.level,m.problem,m.conditions,m.hint1,m.hint2,m.blocks,m.image,m.enabled]));
    }
    SpreadsheetApp.flush();
  } finally {lock.releaseLock();}
}
function rows(ss,name,columnsBySheet){
  const sheet=ss.getSheetByName(name);
  const [columns,...data]=sheet.getDataRange().getValues();
  if(columnsBySheet)columnsBySheet.set(name,columns);
  return data.map((line,i)=>Object.assign({_row:i+2},Object.fromEntries(columns.map((key,j)=>[key,line[j]]))));
}
function sheetColumns(sheet,name,columnsBySheet){
  if(columnsBySheet?.has(name))return columnsBySheet.get(name);
  const columns=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  if(columnsBySheet)columnsBySheet.set(name,columns);
  return columns;
}
function append(ss,name,data,columnsBySheet){
  const sheet=ss.getSheetByName(name);
  const columns=sheetColumns(sheet,name,columnsBySheet);
  const values=Object.fromEntries(headers[name].map((key,i)=>[key,data[i]??'']));
  sheet.appendRow(columns.map(h=>escapeCell(values[h]??'')));
}
function date(value){return value instanceof Date?value.toISOString():String(value||'');}
function reviewHistory(value){
  try{
    const history=JSON.parse(String(value||'[]'));
    return Array.isArray(history)?history.filter(event=>Array.isArray(event)&&event.length===7):[];
  }catch{return [];}
}
function rosterFor(ss,room,id){
  return rows(ss,'학생명단').map(r=>({id:String(r.학생ID),room:normalizeNo(r.반),number:normalizeNo(r.번호),name:String(r.이름).trim(),role:String(r.역할||'학생').trim()})).filter(p=>p.id&&p.name&&['학생','student'].includes(p.role)&&p.room===room&&(!id||p.id===id));
}
function snapshot(ss,students,helper,columnsBySheet){
  const ids=new Set(students.map(p=>p.id));
  const raw=table=>rows(ss,table,columnsBySheet).filter(r=>ids.has(String(r.학생ID)));
  const legacy={'검수 대기':'pending','검수대기':'pending','대기':'pending','대기 중':'pending','대기중':'pending','재도전 요청':'retrying','재도전':'retrying','승인 완료':'done','승인완료':'done','승인':'done','완료':'done','미션 완료':'done','pending':'pending','retrying':'retrying','done':'done','approved':'done','retry':'retrying'};
  const submissions=raw('미션제출').filter(r=>r.제출ID&&[1,2,3,4,5].includes(Number(r.미션번호))).map(r=>({id:String(r.제출ID),student:String(r.학생ID),n:Number(r.미션번호),url:shareUrl(r['MakeCode URL']),time:date(r.제출시간),reviewed:date(r.검수시간),actor:String(r.검수자),state:legacy[String(r.검수상태).trim()]||'pending',previous:String(r.이전제출ID),...(helper?{row:r._row,history:reviewHistory(r.검수이력JSON)}:{})}));
  const progress=raw('미션진행').map(r=>({student:String(r.학생ID),n:Number(r.미션번호),time:date(r.시작시간)}));
  const snacks=raw('차수간식이력').map(r=>({student:String(r.학생ID),n:Number(r.지급차수),state:r.지급상태,time:date(r.처리시간)}));
  const missions=rows(ss,'미션정보').filter(r=>[1,2,3,4,5].includes(Number(r.미션번호))).map(r=>({n:Number(r.미션번호),title:r.미션제목,level:r.난이도,problem:r.문제,conditions:r.성공조건,hint1:r.힌트1,hint2:r.힌트2,blocks:r.필요블록,image:r.이미지,enabled:r.사용여부===true||['true','사용','y','1'].includes(String(r.사용여부).toLowerCase())}));
  return {students,submissions,progress,snacks,missions};
}
function passwordHash(password,salt){
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(salt+'\n'+password,props().getProperty('PEPPER'),Utilities.Charset.UTF_8));
}
function sameHash(a,b){
  if(typeof b!=='string'||a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
function helperVersion(row){
  if(!row||String(row.사용여부).trim()!=='Y'||(row.권한&&row.권한!=='helper'))return '';
  return String(row.비밀번호해시V2||row.비밀번호해시||'').trim();
}
function helperPasswordMatches(row,password){
  const stored=helperVersion(row);
  if(!stored||typeof password!=='string'||password.length>128)return false;
  if(row.비밀번호해시V2)return sameHash(passwordHash(password,row.솔트),stored);
  const [salt,digest]=stored.split(':');
  if(!salt||!/^[a-f0-9]{64}$/.test(digest||''))return false;
  let value=salt+':'+password;
  for(let i=0;i<1000;i++){
    const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8);
    value=bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  }
  return sameHash(value,digest);
}
function saveHelper(ss,id,room,password,existing=rows(ss,'도우미계정').find(r=>String(r.계정ID)===id)){
  if(!/^[a-zA-Z0-9_.-]{2,64}$/.test(id)||![1,2,3,4,5].includes(room)||typeof password!=='string'||password.length<12||password.length>128)throw new Error('계정 ID, 담당 반, 12~128자 비밀번호를 확인해 주세요.');
  const salt=randomKey();
  const data=[id,room,'Y',existing?.비밀번호해시||'','helper',salt,passwordHash(password,salt)];
  if(!existing){append(ss,'도우미계정',data);return;}
  const sheet=ss.getSheetByName('도우미계정');
  const range=sheet.getRange(existing._row,1,1,sheet.getLastColumn());
  const old=range.getValues()[0];
  const columns=sheet.getRange(1,1,1,old.length).getDisplayValues()[0];
  headers.도우미계정.forEach((key,i)=>{old[columns.indexOf(key)]=escapeCell(data[i]);});
  range.setValues([old]);
}
function setHelper(){
  const ui=SpreadsheetApp.getUi();
  const ask=label=>{const result=ui.prompt('도우미 계정',label,ui.ButtonSet.OK_CANCEL);return result.getSelectedButton()===ui.Button.OK?result.getResponseText():null;};
  const id=ask('계정 ID를 입력하세요.');
  if(id===null)return;
  const room=ask('담당 반 번호를 입력하세요.');
  if(room===null)return;
  const password=ask('임시 비밀번호를 입력하세요 (12~128자).');
  if(password===null)return;
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {saveHelper(spreadsheet(),id.trim(),normalizeNo(room),password);SpreadsheetApp.flush();} finally {lock.releaseLock();}
  ui.alert('도우미 계정을 저장했습니다.');
}
function reviewRow(ss,record,state,actor,time,columnsBySheet){
  const sheet=ss.getSheetByName('미션제출');
  const cols=sheetColumns(sheet,'미션제출',columnsBySheet);
  const range=sheet.getRange(record.row,1,1,cols.length);
  const old=range.getValues()[0];
  const event=[Utilities.getUuid(),record.id,record.state==='done'?'승인 취소':state==='done'?'승인':'재도전',record.state,state,actor,time];
  const log=record.history;
  const values={'검수상태':state,'검수자':actor,'검수시간':time,'최종수정시간':time,'최종수정자':actor,'검수이력JSON':JSON.stringify([...log,event])};
  for(const [k,v] of Object.entries(values))old[cols.indexOf(k)]=escapeCell(v);
  range.setValues([old.map(escapeCell)]);
  record.state=state;
  record.reviewed=time;
  record.actor=actor;
  log.push(event);
  try {append(ss,'검수이력',event,columnsBySheet);} catch(error){console.error('검수이력 시트 복제 실패: '+event[0]);}
}
function sessionUser(cache,token){
  if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))return null;
  const value=cache.get('sess:'+token);
  return value?JSON.parse(value):null;
}
function authenticate(ss,cache,a){
  const role=a.role;
  const key=role==='helper'?'helper:'+String(a.id||'').trim():'student:'+normalizeNo(a.room)+':'+normalizeNo(a.number);
  if(key.length>100)throw new Error('로그인 정보를 확인해 주세요.');
  const tries=Number(cache.get('tries:'+key)||0);
  if(tries>=8)throw new Error('로그인 시도가 많습니다. 5분 뒤에 다시 시도해 주세요.');
  let user;
  let version;
  if(role==='helper'){
    const row=rows(ss,'도우미계정').find(r=>String(r.계정ID).trim()===String(a.id||'').trim());
    const room=normalizeNo(row?.담당반);
    if([1,2,3,4,5].includes(room)&&helperPasswordMatches(row,a.password)){
      user={role,id:String(row.계정ID).trim(),room};
      version=helperVersion(row);
    }
  } else if(role==='student'){
    const room=normalizeNo(a.room),number=normalizeNo(a.number);
    const p=rosterFor(ss,room,'').find(r=>r.number===number&&r.name===String(a.name||'').trim());
    if(p)user={role,id:p.id,room:p.room,number:p.number,name:p.name};
  }
  if(!user){cache.put('tries:'+key,String(tries+1),300);throw new Error('입력한 로그인 정보가 일치하지 않습니다.');}
  cache.remove('tries:'+key);
  const token=randomKey();
  cache.put('sess:'+token,JSON.stringify({user,version}),14400);
  return {token,user};
}
function doPost(e){
  const response=data=>ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  if(!e?.postData?.contents || e.postData.contents.length>30000)return response({ok:false,message:'요청 형식을 확인해 주세요.'});
  let lock;
  let locked=false;
  try {
    const {action,args={},token}=JSON.parse(e.postData.contents);
    const cache=CacheService.getScriptCache();
    const session=action==='login'?null:sessionUser(cache,token);
    if(action!=='login'&&!session)return response({ok:false,code:'SESSION',message:'세션이 종료되었습니다. 다시 로그인해 주세요.'});
    if(action==='logout'){cache.remove('sess:'+token);return response({ok:true,data:{}});}
    const ss=spreadsheet();
    if(action!=='view'){
      lock=LockService.getScriptLock();
      locked=lock.tryLock(15000);
      if(!locked)return response({ok:false,message:'다른 요청을 처리 중입니다. 잠시 후 다시 시도해 주세요.'});
      if(session&&!sessionUser(cache,token))return response({ok:false,code:'SESSION',message:'세션이 종료되었습니다. 다시 로그인해 주세요.'});
    }
    if(action==='login')return response({ok:true,data:authenticate(ss,cache,args)});
    const user=session.user;
    const helper=user.role==='helper';
    const account=helper?rows(ss,'도우미계정').find(r=>String(r.계정ID).trim()===user.id&&helperVersion(r)===session.version&&normalizeNo(r.담당반)===user.room):null;
    const students=action==='password'&&helper?[]:rosterFor(ss,user.room,helper?'':user.id);
    if(helper?!account:!students.length)
      return response({ok:false,code:'SESSION',message:'계정 정보가 변경되었습니다. 다시 로그인해 주세요.'});
    if(action==='password'&&helper){
      if(!helperPasswordMatches(account,args.old))throw new Error('현재 비밀번호가 일치하지 않습니다.');
      saveHelper(ss,user.id,user.room,args.password,account);
      SpreadsheetApp.flush();
      cache.remove('sess:'+token);
      return response({ok:true,data:{}});
    }
    const columnsBySheet=new Map();
    const db=snapshot(ss,students,helper,columnsBySheet);
    const now=new Date().toISOString();
    const runtime={now,id:()=>Utilities.getUuid(),
      add(type,r){
        if(type==='progress')append(ss,'미션진행',[r.student,r.n,r.time,r.time,'도전 중'],columnsBySheet);
        if(type==='submissions')append(ss,'미션제출',[r.id,r.student,r.n,r.url,r.time,r.state,'','',r.time,user.id,r.previous],columnsBySheet);
        if(type==='snacks')append(ss,'차수간식이력',[r.student,r.n,r.state,r.time,r.actor],columnsBySheet);
        db[type].push(r);
      },
      review:(r,state,actor,time)=>reviewRow(ss,r,state,actor,time,columnsBySheet)
    };
    const data=operate(db,user,action,args,runtime);
    if(locked){
      SpreadsheetApp.flush();
      lock.releaseLock();
      locked=false;
      if(args.includeView===true)data.view=operate(db,user,'view',{},runtime);
    }
    return response({ok:true,data});
  } catch(error){
    const msg=String(error.message||'');
    if(/[가-힣]/.test(msg)&&!(error instanceof SyntaxError))return response({ok:false,message:msg});
    console.error(error.stack||msg);
    return response({ok:false,message:'시트에 연결하거나 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'});
  } finally {if(locked)lock.releaseLock();}
}
