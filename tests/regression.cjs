const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const path=require('node:path');
const proposed=path.resolve(__dirname, '..')+'/';let checks=0;
function check(name,fn){fn();checks++;console.log('PASS',name)}
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:'',style:{},addEventListener(){},classList:{remove(){},add(){}}});return elements.get(id)};
const front={document:{getElementById:el,querySelectorAll:()=>[]},window:{location:{},isSecureContext:false},AbortController,setTimeout,clearTimeout,navigator:{userAgent:'iPhone'},alert(){},prompt:(title,text)=>{front.promptText=text},console};vm.createContext(front);vm.runInContext(fs.readFileSync(proposed+'admin.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],front);
for(const [input,expected] of [['1086123392','01086123392'],['010-8612-3392','01086123392'],['+82 10-8612-3392','01086123392'],['02-1234-5678','0212345678'],['010-8612-3392 / 010-1234-5678',''],['0108612339201012345678',''],['0108612339',''],['연락없음 123',''],[null,''],[undefined,'']])check('phone '+String(input),()=>assert.equal(front.normalizePhone(input),expected));
check('Seoul formatting',()=>assert.equal(front.formatPhone('0212345678'),'02-1234-5678'));
check('escape HTML',()=>assert.equal(front.escapeHtml('<img src=x onerror="x">'),'&lt;img src=x onerror=&quot;x&quot;&gt;'));
(async()=>{await front.copyKakaoMessage();check('clipboard absent fallback',()=>assert.equal(front.promptText,'안녕하세요. 오늘 초청하신 분 오셨는지 상담 가능하신지 여부 확인 부탁드립니다.'));
front.window.isSecureContext=true;front.navigator.clipboard={writeText:async()=>{throw new Error('NotAllowedError')}};
await front.copyKakaoMessage();check('clipboard permission rejection fallback',()=>assert.equal(front.promptText,'안녕하세요. 오늘 초청하신 분 오셨는지 상담 가능하신지 여부 확인 부탁드립니다.'));
const msg='안녕하세요. 오늘 초청하신 분 오셨는지 상담 가능하신지 여부 확인 부탁드립니다.';
check('iOS SMS URL',()=>{front.sendSmsToInviter('010-8612-3392');assert.equal(front.window.location.href,'sms:01086123392&body='+encodeURIComponent(msg))});
front.navigator.userAgent='Android';check('Android SMS URL',()=>{front.sendSmsToInviter('010-8612-3392');assert.equal(front.window.location.href,'sms:01086123392?body='+encodeURIComponent(msg))});
for (const [name,response,expected] of [['500',{ok:false},'HTTP_ERROR'],['HTML',{ok:true,text:async()=>'<html>error</html>'},'INVALID_RESPONSE'],['null JSON',{ok:true,text:async()=>'null'},'INVALID_RESPONSE'],['logical error',{ok:true,text:async()=>JSON.stringify({result:'error',code:'BUSY'})},'BUSY']]){
front.fetch=async()=>response;let actual='';try{await front.requestJson('https://mock.invalid')}catch(e){actual=e.message}check('fetch '+name,()=>assert.equal(actual,expected));
}
let lockAvailable=true,rows=[['headers']],reads=0,flushes=0,maxColumns=8;
const key='a'.repeat(48);
const sheet={
 getLastRow:()=>rows.length,
 getMaxColumns:()=>maxColumns,
 insertColumnsAfter:(after,count)=>{assert.equal(after,maxColumns);maxColumns+=count;},
 getRange:(r,c,n=1,k=1)=>({
  setNumberFormat(){},
  setValues(values){for(let i=0;i<n;i++){rows[r-1+i]??=[];for(let j=0;j<k;j++)rows[r-1+i][c-1+j]=values[i][j];}},
  setValue(value){rows[r-1]??=[];rows[r-1][c-1]=value;},
  getValue(){return rows[r-1]?.[c-1]??'';},
  getValues(){reads++;return Array.from({length:n},(_,i)=>Array.from({length:k},(_,j)=>rows[r-1+i]?.[c-1+j]??''));}
 })
};
const gas={console,PropertiesService:{getScriptProperties:()=>({getProperties:()=>({SPREADSHEET_ID:'mock',SHEET_NAME:'mock',ADMIN_TOKEN_SHA256:crypto.createHash('sha256').update(key).digest('hex')})})},LockService:{getScriptLock:()=>({tryLock:()=>lockAvailable,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){flushes++}},Utilities:{formatDate:()=> '2026-10-07 15:00:00',DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(alg,text)=>[...crypto.createHash('sha256').update(text).digest()]},ContentService:{MimeType:{JSON:'JSON'},createTextOutput:s=>({text:s,setMimeType(){return this}})}};
vm.createContext(gas);vm.runInContext(fs.readFileSync(proposed+'Code.gs','utf8'),gas);const post=data=>JSON.parse(gas.doPost({parameter:data}).text);const valid={inviter:'송재용',inviter_phone:'1086123392',invitee:'김철수',invitee_phone:'010-1234-5678',day:'wed',time:'pm',note:'쉼표, 줄바꿈\n& <특수>',church:'  기쁜소식부산대연교회  '};
check('public GET denied before reads',()=>{assert.equal(JSON.parse(gas.doGet({}).text).code,'UNAUTHORIZED');assert.equal(reads,0)});
check('unconfigured PIN denied',()=>assert.equal(post({action:'list',admin_token:'1234'}).code,'UNAUTHORIZED'));
check('unknown operation denied',()=>assert.equal(post({action:'erase'}).code,'INVALID_INPUT'));
check('wrong key denied',()=>assert.equal(post({action:'list',admin_token:'b'.repeat(48)}).code,'UNAUTHORIZED'));
check('blank rejected',()=>assert.equal(post({}).code,'INVALID_INPUT'));
check('unsupported day rejected',()=>assert.equal(post({...valid,day:'sat'}).code,'INVALID_INPUT'));
check('multiple phone rejected',()=>assert.equal(post({...valid,inviter_phone:'010-8612-3392/010-1234-5678'}).code,'INVALID_PHONE'));
lockAvailable=false;check('lock failure prevents append',()=>{assert.equal(post(valid).code,'BUSY');assert.equal(rows.length,1)});lockAvailable=true;
check('9 columns preserve contacts and notes; church appended',()=>{assert.equal(post(valid).result,'success');assert.equal(rows[1].length,9);assert.equal(rows[1][8],valid.church.trim());assert.equal(rows[0][8],'소속 교회');assert.equal(rows[1][2],'01086123392');assert.equal(rows[1][4],'01012345678');assert.equal(rows[1][7],valid.note);assert.equal(flushes,1)});
check('formula input escaped',()=>{post({...valid,note:'=1+1'});assert.equal(rows[2][7],"'=1+1")});
check('authenticated list reverse order',()=>{const result=post({action:'list',admin_token:key});assert.equal(result.data.length,2);assert.equal(result.data[0].note,"'=1+1");assert.equal(result.data[1].note,valid.note)});
check('church returned to admin',()=>assert.equal(post({action:'list',admin_token:key}).data[0].church,valid.church.trim()));
check('long church rejected before saving',()=>{const count=rows.length;assert.equal(post({...valid,church:'가'.repeat(101)}).code,'INVALID_INPUT');assert.equal(rows.length,count)});
check('church is optional for older clients',()=>{const data={...valid};delete data.church;assert.equal(post(data).result,'success');assert.equal(rows.at(-1)[8],'')});
check('church formula escaped',()=>{assert.equal(post({...valid,church:'=1+1'}).result,'success');assert.equal(rows.at(-1)[8],"'=1+1")});
check('legacy 8-column rows have empty church',()=>{rows.push(['old timestamp','old inviter','','old invitee','','10.14(수)','am','old note']);const item=post({action:'list',admin_token:key}).data[0];assert.equal(item.church,'');assert.equal(item.note,'old note')});
check('migration refuses occupied I column',()=>{const oldHeader=rows[0][8];rows[0][8]='다른 데이터';const count=rows.length;assert.equal(post(valid).code,'SERVER_ERROR');assert.equal(rows.length,count);assert.equal(rows[0][8],'다른 데이터');rows[0][8]=oldHeader;});
let configured, selected='OK', setupToken=key;
sheet.getName=()=> '접수';
gas.SpreadsheetApp.getActiveSpreadsheet=()=>({getId:()=> 'test-sheet',getActiveSheet:()=>sheet});
gas.SpreadsheetApp.getUi=()=>({ButtonSet:{OK_CANCEL:'OK_CANCEL'},Button:{OK:'OK'},prompt:()=>({getSelectedButton:()=>selected,getResponseText:()=>setupToken}),alert(){}});
gas.PropertiesService.getScriptProperties=()=>({setProperties:value=>{configured=value;}});
selected='CANCEL';check('setup cancellation makes no changes',()=>{gas.configureCounseling();assert.equal(configured,undefined)});
selected='OK';setupToken='123';check('setup rejects invalid PIN',()=>{gas.configureCounseling();assert.equal(configured,undefined)});
setupToken='1234';check('setup accepts 4-digit PIN and stores only hash',()=>{gas.configureCounseling();assert.equal(configured.ADMIN_TOKEN_SHA256,crypto.createHash('sha256').update(setupToken).digest('hex'));assert.equal(gas.authorized_('1234',configured),true);assert.equal(gas.authorized_('4321',configured),false);assert.equal(gas.authorized_('',configured),false);assert.equal(JSON.stringify(configured).includes(setupToken),false)});
for (const value of ['123','12345','abcd','１２３４']) check('invalid PIN format '+value,()=>assert.equal(gas.validCredential_(value),false));
check('PIN retains leading zero',()=>assert.equal(gas.authorized_('0123',{ADMIN_TOKEN_SHA256:crypto.createHash('sha256').update('0123').digest('hex')}),true));
setupToken=key;const before=JSON.stringify(rows.map(row=>Array.from({length:8},(_,i)=>row[i]??'')));
check('setup preserves existing data and stores only key hash',()=>{gas.configureCounseling();assert.equal(JSON.stringify(rows.map(row=>Array.from({length:8},(_,i)=>row[i]??''))),before);assert.equal(configured.SPREADSHEET_ID,'test-sheet');assert.equal(configured.SHEET_NAME,'접수');assert.equal(configured.ADMIN_TOKEN_SHA256,crypto.createHash('sha256').update(key).digest('hex'));assert.equal(JSON.stringify(configured).includes(key),false)});
rows=[];check('setup adds 9 headers to empty sheet',()=>{gas.configureCounseling();assert.equal(rows.length,1);assert.equal(rows[0].length,9);assert.equal(rows[0][0],'접수일시');assert.equal(rows[0][8],'소속 교회')});
console.log('TOTAL',checks);})().catch(e=>{console.error(e);process.exit(1)});
