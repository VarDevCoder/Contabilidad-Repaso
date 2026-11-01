// Node 22+; servidor estático en 8765 y Chrome aislado con CDP en 9227.
// Crea un contexto efímero; no escribe en el almacenamiento de las otras pestañas.
const assert=require('node:assert/strict');
const fs=require('node:fs');
async function main(){
  const browser=await (await fetch('http://127.0.0.1:9227/json/version')).json();
  const ws=new WebSocket(browser.webSocketDebuggerUrl),pending=new Map(),errors=[];
  let sequence=0,sessionId;const loadWaiters=[];
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
    if(message.method==='Page.loadEventFired')loadWaiters.splice(0).forEach(resolve=>resolve());
    if(message.id){const entry=pending.get(message.id);if(entry){pending.delete(message.id);message.error?entry.reject(new Error(JSON.stringify(message.error))):entry.resolve(message.result)}}
  };
  function send(method,params={},browserCommand=false){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(!browserCommand&&sessionId?{sessionId}:{})}))})}
  async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value}
  async function loaded(){for(let i=0;i<100;i++){if(await evaluate("document.readyState==='complete'&&!!document.querySelector('#welcomeTitle,.page-header')"))return;await new Promise(r=>setTimeout(r,30))}throw new Error('La página no terminó de cargar')}
  async function navigate(method,params={}){const done=new Promise(resolve=>loadWaiters.push(resolve));await send(method,params);await done;await loaded()}
  async function click(selector){assert.equal(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`),true,selector);await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus();document.querySelector(${JSON.stringify(selector)}).click()`)}
  async function viewport(width){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});assert.equal(await evaluate('innerWidth'),width)}
  async function screenshot(name){if(process.env.UNIBE_SCREENSHOTS!=='1')return;const metrics=await send('Page.getLayoutMetrics');const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}});fs.writeFileSync(name,Buffer.from(r.data,'base64'))}
  const {browserContextId}=await send('Target.createBrowserContext',{disposeOnDetach:true});
  const {targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId});
  sessionId=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await send('Page.enable');await send('Runtime.enable');await viewport(1440);
  await navigate('Page.navigate',{url:'http://127.0.0.1:8765/'});
  await click('[data-nav="materiales"]');
  assert.equal(await evaluate("document.querySelectorAll('.material-class').length"),12);
  assert.equal(await evaluate("COURSE_MATERIALS.flatMap(c=>c.resources).filter(r=>r.type==='Video').length"),11);
  assert.equal(await evaluate("COURSE_MATERIALS.reduce((n,c)=>n+c.resources.length,0)"),45);
  assert.equal(await evaluate("document.querySelectorAll('#root iframe').length"),0);
  assert.equal(await evaluate("document.querySelectorAll('#root a[target=\"_blank\"]:not([rel*=\"noopener\"])').length"),0);
  // Los controles ejecutan sus eventos reales, no solo funciones de filtrado.
  await evaluate("document.querySelector('#materialType').value='Video';document.querySelector('#materialType').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelectorAll('#materialsList .listrow').length"),11);
  await evaluate("document.querySelector('#materialClass').value='8';document.querySelector('#materialClass').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelectorAll('#materialsList .listrow').length"),4);
  await evaluate("document.querySelector('#materialSearch').value='texto inexistente xyz';document.querySelector('#materialSearch').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#materialsList').textContent.includes('No hay materiales')"),true);
  await evaluate("materialFilters.search='';materialFilters.type='all';materialFilters.classNumber='all';render()");
  const saved=await evaluate("localStorage.getItem('repaso-unibe-v1')");
  await navigate('Page.reload');
  assert.equal(await evaluate('state.screen'),'materiales');
  assert.equal(await evaluate("localStorage.getItem('repaso-unibe-v1')"),saved);
  assert.equal(await evaluate('CLASS_GUIDES[4].task.process.length'),5);
  assert.equal(await evaluate('CLASS_GUIDES[7].task.process.length'),5);
  assert.equal(await evaluate("COURSE_MATERIALS.flatMap(c=>c.resources).filter(r=>r.status.includes('Acceso restringido comprobado')).length"),2);
  for(const theme of ['dark','light'])for(const width of [320,390,1440]){
    await viewport(width);
    await evaluate(`setTheme('${theme}');render();document.querySelectorAll('.material-class details').forEach(d=>d.open=true)`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`Materiales sin desbordamiento: ${width} ${theme}`);
  }
  await evaluate("state.quiz=null;state.exam=null;state.topic='all';beginQuiz();state.quiz.chosen=1;save();go('materiales')");
  assert.equal(await evaluate('state.quiz.paused'),true);
  await navigate('Page.reload');
  assert.equal(await evaluate('state.quiz.chosen'),1);
  assert.equal(await evaluate('state.screen'),'materiales');
  await evaluate('resumeSession()');
  assert.equal(await evaluate('state.quiz.paused'),false);
  assert.equal(await evaluate('state.screen'),'practica');
  assert.deepEqual(errors,[],'Sin errores JavaScript');
  console.log('PASS: 45 referencias, 11 videos, 12 secciones, filtros y búsqueda, consignas, estados de fuentes, enlaces seguros, sin reproductores externos, recarga y sesiones; dark/light a 320/390/1440 px.');
  await send('Target.disposeBrowserContext',{browserContextId},true);ws.close();
}
main().catch(error=>{console.error(error);process.exit(1)});
