const assert=require('node:assert/strict');
const {BrowserQA}=require('./qa-browser.cjs');
const results=[];
async function check(name,run){await run();results.push(name);console.log('PASS: '+name)}
async function studyFlow(width,touch){
  const q=await BrowserQA.open({width,touch});
  try{
    await check(`Navegación real ${width}px ${touch?'táctil':'mouse'} en diez módulos`,async()=>{
      for(const screen of ['materiales','temario','practica','flash','errores','examen','dashboard','emergencia','desarrollo','home'])await q.route(screen);
      assert.equal(await q.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    });
    await check(`Materiales: filtros nativos, búsqueda y apertura de enlaces ${width}px`,async()=>{
      await q.route('materiales');await q.select('#materialType','Video');assert.equal(await q.evaluate("document.querySelectorAll('#materialsList .listrow').length"),11);
      await q.select('#materialClass','8');assert.equal(await q.evaluate("document.querySelectorAll('#materialsList .listrow').length"),4);
      await q.type('#materialSearch','xyzsinresultado');assert.ok(await q.evaluate("document.querySelector('#materialsList').textContent.includes('No hay materiales')"));
      await q.type('#materialSearch','');await q.select('#materialClass','all');await q.select('#materialType','all');await q.click('.material-class details>summary');
      assert.equal(await q.evaluate("document.querySelector('.material-class details').open"),true);
      await q.click('.material-class>a');
      const targets=(await q.send('Target.getTargets',{},true)).targetInfos.filter(t=>t.browserContextId===q.contextId);
      assert.ok(targets.some(t=>t.targetId!==q.targetId&&t.url.startsWith('https://ad.unibe.edu.py/')),'El enlace debe abrir Moodle en otra pestaña');
      for(const target of targets.filter(t=>t.targetId!==q.targetId))await q.send('Target.closeTarget',{targetId:target.targetId},true);
    });
    await check(`Práctica completa de 57 preguntas ${width}px; aciertos/errores, recarga y pausa`,async()=>{
      await q.route('practica');await q.click(await q.evaluate("!!document.querySelector('#again')")?'#again':'#startPractice');
      assert.equal(await q.evaluate("document.querySelector('#checkOrNext').disabled"),true);
      const expected={right:0,wrong:0};
      for(let i=0;i<57;i++){
        const question=await q.evaluate('QUESTIONS.find(q=>q.id===state.quiz.ids[state.quiz.at])');
        const good=i%3!==0;expected[good?'right':'wrong']++;
        await q.click(`[data-answer="${good?question.answer:(question.answer+1)%4}"]`);
        if(i===0){await q.reload();assert.equal(await q.evaluate('state.quiz.chosen'),(question.answer+1)%4)}
        await q.click('#checkOrNext');
        assert.equal(await q.evaluate(`state.hist['${question.id}'].seen`),1);
        assert.equal(await q.evaluate("document.querySelectorAll('.answer:disabled').length"),4);
        if(i===1){await q.reload();assert.equal(await q.evaluate('state.quiz.checked'),true)}
        if(i===20){await q.route('materiales');assert.equal(await q.evaluate('state.quiz.paused'),true);await q.reload();await q.click('#resumeSession')}
        if(i===30){await q.click('#pauseSession');assert.equal(await q.evaluate('state.quiz.paused'),true);await q.click('#resumeSession')}
        await q.click('#checkOrNext');
      }
      assert.equal(await q.evaluate('state.quiz.right'),expected.right);assert.equal(await q.evaluate('state.quiz.wrong'),expected.wrong);
      assert.equal(await q.evaluate('done()'),57);assert.equal(await q.evaluate('wrongIds().length'),19);
      assert.ok(await q.evaluate("document.querySelector('#root').textContent.includes('Terminaste esta ronda')"));
      await q.route('dashboard');
      const units=await q.evaluate('TOPICS.map(t=>({id:t.id,total:QUESTIONS.filter(q=>q.topic===t.id).length,...unitStats(t.id)}))');
      assert.equal(units.reduce((n,u)=>n+u.answered,0),57);assert.equal(units.reduce((n,u)=>n+u.errors,0),19);assert.equal(units.reduce((n,u)=>n+u.right,0),expected.right);
      assert.ok(units.every(u=>u.answered===u.total));
    });
    await check(`Recuperación de los 19 errores y estado vacío ${width}px`,async()=>{
      await q.route('errores');await q.click('#retryWrong');
      for(let i=0;i<19;i++){const answer=await q.evaluate('QUESTIONS.find(q=>q.id===state.quiz.ids[state.quiz.at]).answer');await q.click(`[data-answer="${answer}"]`);await q.click('#checkOrNext');await q.click('#checkOrNext')}
      assert.equal(await q.evaluate('wrongIds().length'),0);assert.equal(await q.evaluate('accuracy()'),75);
      await q.route('errores');assert.ok(await q.evaluate("document.querySelector('.empty').textContent.includes('Sin errores pendientes')"));
    });
    await check(`Búsqueda y filtros académicos; 22 flashcards ${width}px`,async()=>{
      await q.route('temario');await q.type('#termSearch','zzzzsinresultado');assert.ok(await q.evaluate("document.querySelector('#notes').textContent.includes('No se encontraron')"));
      await q.type('#termSearch','contabilidad');assert.ok(await q.evaluate("document.querySelectorAll('#notes .note').length>0"));
      await q.type('#termSearch','');await q.click('[data-filter="admin"]');assert.equal(await q.evaluate('state.topic'),'admin');
      await q.route('flash');await q.click('[data-flashtopic="all"]');
      for(let i=0;i<22;i++){assert.equal(await q.evaluate('state.flashIndex%FLASH.length'),i);await q.click('#flip');assert.equal(await q.evaluate('state.flashBack'),true);await q.click('#flashNext')}
      await q.click('#flashPrev');assert.equal(await q.evaluate('state.flashIndex%FLASH.length'),21);
      for(const id of ['empresa','admin','formalizacion','contabilidad','software']){await q.click(`[data-flashtopic="${id}"]`);assert.equal(await q.evaluate('state.flashTopic'),id);await q.click('#flip')}
    });
    await check(`Desarrollo: borrador, revisión, dominio e invalidación al editar ${width}px`,async()=>{
      await q.route('desarrollo');await q.click('[data-devtopic="admin"]');await q.type('#text-d4','Prever, organizar, dirigir, coordinar y controlar.');await q.click('[data-review="d4"]');await q.click('[data-mastery="d4"]');
      assert.equal(await q.evaluate('state.development.d4.mastered'),true);await q.reload();assert.equal(await q.evaluate('state.development.d4.mastered'),true);
      await q.click('[data-devtopic="admin"]');await q.type('#text-d4','Respuesta cambiada <img src=x onerror=alert(1)>');assert.equal(await q.evaluate('state.development.d4.mastered'),false);assert.equal(await q.evaluate('state.development.d4.reviewed'),false);assert.equal(await q.evaluate("document.querySelectorAll('#root img').length"),0);
      await q.route('dashboard');assert.equal(await q.evaluate("unitStats('admin').mastered"),0);
    });
    await check(`Abandonar/cancelar práctica, reiniciar/cancelar progreso ${width}px`,async()=>{
      await q.route('practica');await q.click(await q.evaluate("!!document.querySelector('#again')")?'#again':'#startPractice');
      await q.click('.session-bar summary');await q.dialog('#abandonSession',false);assert.equal(await q.evaluate('!!activeSession()'),true);
      await q.dialog('#abandonSession',true);assert.equal(await q.evaluate('activeSession()'),null);assert.equal(await q.evaluate('done()'),57);
      await q.route('home');await q.dialog('#resetAll',false);assert.equal(await q.evaluate('done()'),57);
      await q.dialog('#resetAll',true);assert.equal(await q.evaluate('done()'),0);assert.equal(await q.evaluate('state.sessions.length'),0);assert.equal(await q.evaluate('Object.keys(state.development).length'),0);
    });
    assert.deepEqual(q.errors,[]);assert.equal(q.requests.some(url=>/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:8765/')),false,'La aplicación no debe cargar servicios externos');
  }finally{await q.close()}
}
async function exams(){
  const q=await BrowserQA.open({width:1440});
  try{
    for(const n of [10,20,30,57])await check(`Simulacro ${n}: tiempo, respuestas, omisiones, confirmación y persistencia`,async()=>{
      await q.route('examen');if(await q.evaluate('!!state.exam'))await q.click('#repeatExam');await q.select('#examCount',String(n));await q.click('#startExam');
      assert.equal(await q.evaluate('state.exam.ids.length'),n);assert.equal(await q.evaluate('new Set(state.exam.ids).size'),n);
      const duration=await q.evaluate('(state.exam.end-Date.now())/60000');assert.ok(Math.abs(duration-(n===57?90:n*1.5))<.05);
      for(let i=0;i<n;i++){
        if(i%3!==2){const answer=await q.evaluate('QUESTIONS.find(q=>q.id===state.exam.ids[state.exam.at]).answer');await q.click(`[data-examanswer="${i%3===0?answer:(answer+1)%4}"]`)}
        if(i===1){const end=await q.evaluate('state.exam.end');await q.reload();assert.equal(await q.evaluate('state.exam.end'),end);await q.click('#pauseSession');const remaining=await q.evaluate('state.exam.remaining');await q.reload();assert.equal(await q.evaluate('state.exam.remaining'),remaining);await q.click('#resumeSession')}
        if(i<n-1)await q.click('#examNext');
      }
      await q.dialog('#examFinish',false);assert.equal(await q.evaluate('state.exam.finished'),false);
      await q.dialog('#examFinish',true);
      assert.equal(await q.evaluate('state.exam.right'),Math.ceil(n/3));assert.equal(await q.evaluate('state.exam.omitted'),Math.floor(n/3));
      assert.equal(await q.evaluate('state.sessions.at(-1).score'),Math.round(Math.ceil(n/3)/n*100));
      assert.equal(await q.evaluate('state.sessions.at(-1).omitted'),Math.floor(n/3));
      const history=await q.evaluate('JSON.stringify(state.hist)'),sessions=await q.evaluate('state.sessions.length');await q.reload();assert.equal(await q.evaluate('JSON.stringify(state.hist)'),history);assert.equal(await q.evaluate('state.sessions.length'),sessions);
    });
    await check('Vencimiento del reloj durante recarga: todas omitidas, una sola finalización',async()=>{
      await q.click('#repeatExam');await q.select('#examCount','10');await q.click('#startExam');await q.evaluate('state.exam.end=Date.now()-100;save()');await q.reload();assert.equal(await q.evaluate('state.exam.finished'),true);assert.equal(await q.evaluate('state.exam.omitted'),10);assert.equal(await q.evaluate('state.sessions.at(-1).score'),0);
      const count=await q.evaluate('state.sessions.length');await q.reload();assert.equal(await q.evaluate('state.sessions.length'),count);
    });
    assert.deepEqual(q.errors,[]);
  }finally{await q.close()}
}
async function storage(){
  let q=await BrowserQA.open({init:"Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}"});
  try{await check('Almacenamiento bloqueado: aviso visible y práctica utilizable',async()=>{assert.ok(await q.evaluate("document.querySelector('[role=alert]').textContent.includes('No se pudo guardar')"));await q.route('practica');await q.click('#startPractice');await q.click('[data-answer="0"]');await q.click('#checkOrNext');assert.equal(await q.evaluate('done()'),1);assert.deepEqual(q.errors,[])})}finally{await q.close()}
  const corrupt='{progreso incompleto';
  q=await BrowserQA.open({init:`localStorage.setItem('repaso-unibe-v1',${JSON.stringify(corrupt)})`});
  try{await check('Progreso ilegible: copia de recuperación antes de escribir',async()=>{assert.equal(await q.evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('repaso-unibe-recovery-')).some(k=>localStorage.getItem(k)===${JSON.stringify(corrupt)})`),true,'No sobrescribir datos ilegibles sin resguardo');assert.ok(await q.evaluate("document.querySelector('[role=alert]')?.textContent.includes('recuperación')"));assert.deepEqual(q.errors,[])})}finally{await q.close()}
  q=await BrowserQA.open({init:`localStorage.setItem('repaso-unibe-v1',${JSON.stringify(corrupt)});Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}`});
  try{await check('Respaldo imposible: el dato original queda sin sobrescribir',async()=>{assert.equal(await q.evaluate("localStorage.getItem('repaso-unibe-v1')"),corrupt);await q.route('temario');assert.equal(await q.evaluate("localStorage.getItem('repaso-unibe-v1')"),corrupt);assert.ok(await q.evaluate("document.querySelector('[role=alert]').textContent.includes('sin sobrescribir')"));assert.deepEqual(q.errors,[])})}finally{await q.close()}
}
async function compact(){
  const q=await BrowserQA.open({width:320,touch:true});
  try{
    await check('320px: las 57 preguntas con selección, corrección y explicación en ambos temas',async()=>{
      const failures=await q.evaluate(`(()=>{const errors=[];for(const theme of ['dark','light']){setTheme(theme);for(const question of QUESTIONS){for(const checked of [false,true]){state.screen='practica';state.quiz={ids:[question.id],at:0,chosen:question.answer,checked,right:checked?1:0,wrong:0,which:'practice',answers:{}};render();if(document.documentElement.scrollWidth>innerWidth)errors.push(theme+':'+question.id+':'+checked)}}}return errors})()`);
      assert.deepEqual(failures,[]);
    });
    await check('Simulacro táctil a 320px: selección, hoja de 57 respuestas, salto, pausa y abandono',async()=>{
      await q.evaluate("state.quiz=null;state.exam=null;go('examen')");await q.select('#examCount','57');await q.click('#startExam');
      await q.click('[data-examanswer="0"]');await q.click('.columns>.panel:last-child>details>summary');await q.click('[data-examjump="56"]');assert.equal(await q.evaluate('state.exam.at'),56);
      await q.click('#examPrev');assert.equal(await q.evaluate('state.exam.at'),55);await q.click('#examNext');assert.equal(await q.evaluate('state.exam.at'),56);
      await q.route('materiales');assert.equal(await q.evaluate('state.exam.paused'),true);await q.click('#resumeSession');await q.reload();assert.equal(await q.evaluate('state.exam.at'),56);
      await q.click('.session-bar summary');await q.dialog('#abandonSession',false);assert.ok(await q.evaluate('activeSession()'));await q.dialog('#abandonSession',true);assert.equal(await q.evaluate('activeSession()'),null);
    });
    assert.deepEqual(q.errors,[]);
  }finally{await q.close()}
}
async function offline(){
  let q=await BrowserQA.open();
  try{await check('Sesión HTTP ya abierta: estudio y guardado sin red',async()=>{await q.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await q.route('practica');await q.click('#startPractice');await q.click('[data-answer="0"]');await q.click('#checkOrNext');assert.equal(await q.evaluate('done()'),1);assert.equal(await q.evaluate('JSON.parse(localStorage.getItem("repaso-unibe-v1")).quiz.checked'),true);assert.deepEqual(q.errors,[])})}finally{await q.close()}
  const fileUrl=require('node:url').pathToFileURL(require('node:path').resolve('index.html')).href;
  q=await BrowserQA.open({url:fileUrl});
  try{await check('HTML local: apertura directa, recarga sin red y progreso persistente',async()=>{await q.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await q.route('practica');await q.click('#startPractice');await q.click('[data-answer="0"]');await q.click('#checkOrNext');await q.reload();assert.equal(await q.evaluate('state.quiz.checked'),true);assert.equal(await q.evaluate('done()'),1);await q.route('materiales');assert.equal(await q.evaluate("document.querySelectorAll('.material-class').length"),12);assert.deepEqual(q.errors,[])})}finally{await q.close()}
}
async function main(){if(process.argv.includes('--storage'))await storage();else{await studyFlow(1440,false);await studyFlow(390,true);await exams();await storage();await compact();await offline()}console.log(`PASS TOTAL: ${results.length} escenarios de aceptación con entrada de mouse/táctil/teclado y perfiles efímeros.`)}
main().catch(error=>{console.error(error);process.exit(1)});
