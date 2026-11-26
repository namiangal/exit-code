const states = {locked:'잠김',ready:'도전 전',started:'도전 중',pending:'검수 대기',retrying:'재도전 요청',done:'승인 완료'};
const stages = [
  ["비밀 출입증 만들기","기초","비밀기지에 들어가기 위한 출입증을 만들어 보세요.","- A 버튼을 누르면 체크 표시와 함께 성공 소리가 난다.\n- B 버튼을 누르면 X 표시와 함께 실패 소리가 난다.\n- A+B 버튼을 누르면 LED 화면이 지워진다.","버튼을 눌렀을 때 실행되는 블록을 사용해 보세요.","A, B, A+B 버튼 이벤트를 따로 만들어요.\nA에는 ✓와 성공음(전원 켜는 멜로디), B에는 X와 실패음(전원 끄는 멜로디),\nA+B에는 화면 지우기를 넣어요.","버튼 이벤트, 아이콘 출력, 멜로디, 화면 지우기"],
  ["행운의 주사위","기초","어떤 숫자가 나올지 알 수 없는 행운의 전자 주사위를 만들어 보세요!","- 마이크로비트를 흔들면 1~6 사이의 숫자가 무작위로 나타난다.\n- 다시 흔들면 무작위 숫자를 새로 생성한다.\n- A 버튼을 누르면 LED 화면이 지워진다.","마이크로비트를 흔들었을 때 실행되는 블록을 찾아보세요.","흔들기 이벤트 안에서 숫자 출력에 ‘1~6’ 무작위 수(랜덤)를 넣어요. A 버튼 이벤트에는 화면 지우기를 넣어요.","흔들기 이벤트, 무작위 수, 숫자 출력, 화면 지우기"],
  ["에너지 충전하기","기초","비밀기지에서 탈출하려면 에너지가 필요합니다. 버튼을 눌러 에너지를 충전하는 장치를 만들어 보세요!","- 시작할 때 에너지는 0이다.\n- A 버튼을 누를 때마다 에너지가 1씩 증가한다.\n- 현재 에너지 숫자를 LED에 표시한다.\n- B 버튼을 누르면 에너지가 0으로 초기화되고 0이 표시된다.","에너지의 양을 기억할 수 있도록 '에너지'라는 변수를 만들어 보세요.","‘에너지’를 0으로 시작해요.\nA를 누르면 1을 더해 표시하고, B를 누르면 0으로 바꿔 표시해요.","변수, 버튼 이벤트, 숫자 출력"],
  ["마법의 8번 공","응용","나의 운명을 알려주는 신비한 마법의 8번 공을 만들어 보세요. 마이크로비트를 흔들면 어떤 결과가 나타날까요?","- 마이크로비트를 흔들면 1~3 사이의 무작위 숫자를 생성한다.\n- 숫자가 1이면 체크 표시가 나타난다.\n- 숫자가 2이면 X 표시가 나타난다.\n- 숫자가 3이면 지루한 표정이 나타난다.","흔들었을 때 1~3 사이의 무작위 숫자를 만들어 변수에 저장하세요.","뽑은 1~3을 ‘운명’에 저장해요.1이면 ✓, 2이면 X, 그 외에는 지루한 표정을 표시해요.","흔들기 이벤트, 무작위 수, 변수, 조건문, 아이콘 출력"],
  ["비밀 버튼 순서 찾기","응용","비밀기지의 마지막 잠금장치가 나타났습니다. 정해진 버튼 순서를 정확하게 입력하여 탈출에 성공하세요!","- A → B → A 순서로 버튼을 누른다.\n- 정확한 순서로 입력하면 체크 표시와 탈출 성공 효과음이 나온다.\n- 잘못된 순서로 입력하면 X 표시가 나오고 처음부터 다시 시작한다.\n- A+B 버튼을 누르면 초기화되고 화면이 지워진다.","버튼을 몇 단계까지 정확하게 눌렀는지 기억할 '단계' 변수를 만들어 보세요.","올바른 버튼을 누르면 다음 단계로 변경하세요.\n잘못된 버튼을 누르면 X를 표시하고 단계를 0으로 설정하세요.","버튼 이벤트, 변수, 조건문, 아이콘 출력, 멜로디, 화면 지우기"]
];
const defaultMissions = () => stages.map(([title,level,problem,conditions,hint1,hint3,blocks],i)=>({n:i+1,title,level,problem,conditions,hint1,hint2:hint3,hint3,blocks,image:'',enabled:true}));
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
  const lessonMissions=defaultMissions();
  const missions=rows(ss,'미션정보').filter(r=>[1,2,3,4,5].includes(Number(r.미션번호))).map(r=>({n:Number(r.미션번호),...lessonMissions[Number(r.미션번호)-1],image:r.이미지,enabled:r.사용여부===true||['true','사용','y','1'].includes(String(r.사용여부).toLowerCase())}));
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
function doGet(){
  return ContentService.createTextOutput(
    'EXIT CODE API에 연결되었습니다. 학생·도우미 화면은 https://namiangal.github.io/exit-code-test/preview/ 에서 열어 주세요.'
  );
}
function reviewCacheKey(student){
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,student,Utilities.Charset.UTF_8);
  return 'review:'+Utilities.base64EncodeWebSafe(digest);
}
function publishReviewViews(cache,db,students){
  const entries={};
  for(const student of students){
    const submissions=db.submissions.filter(r=>r.student===student.id).map(({history,row,...record})=>record);
    const view=operate({...db,submissions},{id:student.id,role:'student'},'view',{}, {now:''});
    const value=JSON.stringify(view);
    if(value.length<30000)entries[reviewCacheKey(student.id)]=value;
  }
  if(Object.keys(entries).length)cache.putAll(entries,120);
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
    if(action==='reviewCheck'){
      const user=session.user;
      if(user.role!=='student')return response({ok:false,message:'학생만 확인할 수 있습니다.'});
      const cached=cache.get(reviewCacheKey(user.id));
      if(!cached)return response({ok:true,data:{}});
      const view=JSON.parse(cached);
      const ids=Array.isArray(args.ids)?args.ids.slice(0,5):[];
      if(!view.views[0]?.missions.some(m=>ids.includes(m.record?.id)&&['done','retrying'].includes(m.state)))
        return response({ok:true,data:{}});
      const person=rosterFor(spreadsheet(),user.room,user.id)[0];
      if(!person)return response({ok:false,code:'SESSION',message:'계정 정보가 변경되었습니다. 다시 로그인해 주세요.'});
      view.user=user;
      view.views[0].person=person;
      view.reviewCheck=true;
      return response({ok:true,data:{view}});
    }
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
    const reviewedStudents=new Set();
    const now=new Date().toISOString();
    const runtime={now,id:()=>Utilities.getUuid(),
      add(type,r){
        cache.remove(reviewCacheKey(r.student));
        if(type==='progress')append(ss,'미션진행',[r.student,r.n,r.time,r.time,'도전 중'],columnsBySheet);
        if(type==='submissions')append(ss,'미션제출',[r.id,r.student,r.n,r.url,r.time,r.state,'','',r.time,user.id,r.previous],columnsBySheet);
        if(type==='snacks')append(ss,'차수간식이력',[r.student,r.n,r.state,r.time,r.actor],columnsBySheet);
        db[type].push(r);
      },
      review(r,state,actor,time){
        if(!reviewedStudents.has(r.student))cache.remove(reviewCacheKey(r.student));
        reviewRow(ss,r,state,actor,time,columnsBySheet);
        reviewedStudents.add(r.student);
      }
    };
    const data=operate(db,user,action,args,runtime);
    if(locked){
      SpreadsheetApp.flush();
      if(reviewedStudents.size){
        try{publishReviewViews(cache,db,students.filter(p=>reviewedStudents.has(p.id)));}
        catch(error){console.warn('Review notification cache unavailable');}
      }
      lock.releaseLock();
      locked=false;
      if(args.includeView===true)data.view=operate(db,user,'view',{},runtime);
    }
    const view=action==='view'?data:data.view;
    if(view&&!helper)view.reviewCheck=true;
    return response({ok:true,data});
  } catch(error){
    const msg=String(error.message||'');
    if(/[가-힣]/.test(msg)&&!(error instanceof SyntaxError))return response({ok:false,message:msg});
    console.error(error.stack||msg);
    return response({ok:false,message:'시트에 연결하거나 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'});
  } finally {if(locked)lock.releaseLock();}
}
