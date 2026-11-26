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
