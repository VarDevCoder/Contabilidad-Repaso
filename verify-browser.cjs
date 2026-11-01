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
  const seed={hist:{q01:{seen:3,right:2,wrong:1,lastCorrect:false}},sessions:[{time:1,total:10,score:50}],development:{}};
  await evaluate(`Object.assign(state,${JSON.stringify(seed)},{screen:'home',quiz:null,exam:null});save();localStorage.removeItem('repaso-unibe-theme')`);
  await navigate('Page.reload');
  assert.equal(await evaluate('state.hist.q01.seen'),3);
  const saved=await evaluate("localStorage.getItem('repaso-unibe-v1')");
  await screenshot('desktop-review.tmp.png');
  await click('#themeToggle');assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
  assert.equal(await evaluate("localStorage.getItem('repaso-unibe-v1')"),saved,'El tema no debe alterar el progreso');
  await navigate('Page.reload');assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
  const layouts=[];
  for(const theme of ['dark','light']){
    await evaluate(`setTheme('${theme}')`);
    const colors=await evaluate("Object.fromEntries(['bg','panel','text','muted','a','a2','accent-bg','button-text','red','green','correct-bg','wrong-bg'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim()]))");
    function luminance(hex){const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
    for(const [fg,bg] of [['text','bg'],['muted','bg'],['text','panel'],['muted','panel'],['a2','accent-bg'],['button-text','a'],['red','wrong-bg'],['green','correct-bg']]){
      const values=[luminance(colors[fg]),luminance(colors[bg])].sort((a,b)=>b-a);
      assert.ok((values[0]+.05)/(values[1]+.05)>=4.5,`${theme}: contraste insuficiente ${fg}/${bg}`);
    }
    for(const width of [320,390,768,1440]){
      await viewport(width);
      for(const screen of ['home','temario','practica','flash','errores','examen','dashboard','emergencia','desarrollo','materiales']){
        await evaluate(`go('${screen}')`);
        const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,screen:state.screen})");
        assert.ok(layout.scroll<=layout.width,`${theme} ${width} ${screen}: desbordamiento horizontal`);
        layouts.push({theme,width,screen});
      }
    }
  }
  await viewport(390);await evaluate("go('home');setTheme('dark')");await screenshot('mobile-review.tmp.png');
  await click('#themeToggle');await screenshot('mobile-light-review.tmp.png');
  await evaluate("go('temario')");
  await evaluate("document.querySelector('#termSearch').value='contabilidad';document.querySelector('#termSearch').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.ok(await evaluate("document.querySelectorAll('#notes .note').length>0"));
  await evaluate("go('flash')");const front=await evaluate("document.querySelector('#flip').textContent");await click('#flip');assert.notEqual(await evaluate("document.querySelector('#flip').textContent"),front);await click('#flashNext');await click('#flashPrev');
  await evaluate("go('desarrollo')");await click('[data-devtopic="admin"]');assert.equal(await evaluate("document.querySelectorAll('[data-draft]').length"),6);
  await evaluate("document.querySelector('#text-d4').focus()");await send('Input.insertText',{text:'Prever, organizar, dirigir, coordinar y controlar.'});await click('[data-review="d4"]');await click('[data-mastery="d4"]');
  await navigate('Page.reload');assert.equal(await evaluate('state.development.d4.mastered'),true);assert.ok(await evaluate("state.development.d4.text.includes('organizar')"));
  await evaluate("go('emergencia')");await click('#startEmergency');assert.equal(await evaluate("document.body.classList.contains('study-focus')"),true);
  await screenshot('study-review.tmp.png');
  await click('[data-answer="0"]');await click('#checkOrNext');const attempts=await evaluate('Object.values(state.hist).reduce((n,h)=>n+h.seen,0)');
  await navigate('Page.reload');assert.equal(await evaluate('state.quiz.checked'),true);assert.equal(await evaluate('Object.values(state.hist).reduce((n,h)=>n+h.seen,0)'),attempts);
  await click('#checkOrNext');assert.equal(await evaluate('document.activeElement.id'),'currentQuestion');
  await click('#studyNav');assert.equal(await evaluate("document.body.classList.contains('nav-open')"),true);
  await evaluate("document.querySelector('.sidebar .nav:last-child').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  assert.equal(await evaluate('document.activeElement.dataset.nav'),'home');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});assert.equal(await evaluate("document.body.classList.contains('nav-open')"),false);
  await click('#studyNav');await click('[data-nav="temario"]');assert.equal(await evaluate('state.quiz.paused'),true);await click('#resumeSession');assert.equal(await evaluate('state.quiz.paused'),false);
  for(let i=1;i<20;i++){await click('[data-answer="0"]');await click('#checkOrNext');await click('#checkOrNext')}
  assert.ok(await evaluate("document.querySelector('#root').textContent.includes('Terminaste esta ronda')"));
  assert.ok(await evaluate("document.querySelector('#root').textContent.includes('Áreas para reforzar')"));
  await evaluate("go('examen')");await evaluate("document.querySelector('#examCount').value='10'");await click('#startExam');
  await click('[data-examanswer="1"]');const end=await evaluate('state.exam.end');await navigate('Page.reload');assert.equal(await evaluate('state.exam.end'),end);assert.equal(await evaluate('Object.keys(state.exam.answers).length'),1);
  await click('.columns>.panel:last-child>details>summary');
  assert.equal(await evaluate("document.querySelector('.columns>.panel:last-child>details').open"),true);
  await click('.detail-body [data-examjump="4"]');assert.equal(await evaluate('state.exam.at'),4);
  // Finalización por vencimiento sin interacción con diálogos de confirmación.
  await evaluate('state.exam.end=Date.now()-1;updateTime()');assert.equal(await evaluate('state.sessions.at(-1).omitted'),9);
  const sessions=await evaluate('state.sessions.length');await navigate('Page.reload');assert.equal(await evaluate('state.sessions.length'),sessions);
  assert.equal(await evaluate('state.hist.q01.seen>=3'),true);
  assert.deepEqual(errors,[],'Errores de ejecución del navegador');
  console.log(`PASS: ${layouts.length} combinaciones de tema, viewport y módulo; 16 pares de contraste >=4.5:1; filtros, flashcards, desarrollo, foco, teclado, emergencia completa, persistencia, simulacro y omisiones. Sin errores JavaScript.`);
  await send('Target.disposeBrowserContext',{browserContextId},true);ws.close();
}
main().catch(error=>{console.error(error);process.exit(1)});
