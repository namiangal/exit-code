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
