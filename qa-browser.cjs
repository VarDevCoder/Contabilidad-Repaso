// Ayudantes de aceptación: Chrome/CDP local, sin paquetes ni perfil del usuario.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
class BrowserQA{
  constructor(ws){this.ws=ws;this.nextId=0;this.pending=new Map();this.loads=[];this.errors=[];this.requests=[];
    ws.onmessage=event=>{const m=JSON.parse(event.data);
      if(m.id){const p=this.pending.get(m.id);if(p){clearTimeout(p.timeout);this.pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}}
      if(m.method==='Page.loadEventFired'&&m.sessionId===this.sessionId)this.loads.splice(0).forEach(resolve=>resolve());
      if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
      if(m.method==='Network.requestWillBeSent')this.requests.push(m.params.request.url);
    };
  }
  static async open(options={}){
    const info=await(await fetch('http://127.0.0.1:9227/json/version')).json();
    const ws=new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
    const q=new BrowserQA(ws);
    q.contextId=(await q.send('Target.createBrowserContext',{disposeOnDetach:true})).browserContextId;
    q.targetId=(await q.send('Target.createTarget',{url:'about:blank',browserContextId:q.contextId})).targetId;
    q.sessionId=(await q.send('Target.attachToTarget',{targetId:q.targetId,flatten:true})).sessionId;
    await q.send('Page.enable');await q.send('Runtime.enable');await q.send('Network.enable');
    if(options.init)await q.send('Page.addScriptToEvaluateOnNewDocument',{source:options.init});
    await q.viewport(options.width||1440,options.touch||false);
    await q.navigate(options.url||'http://127.0.0.1:8765/');return q;
  }
  send(method,params={},browser=false){return new Promise((resolve,reject)=>{const id=++this.nextId;const timeout=setTimeout(()=>{this.pending.delete(id);reject(new Error('Tiempo agotado: '+method))},15000);this.pending.set(id,{resolve,reject,timeout});this.ws.send(JSON.stringify({id,method,params,...(!browser&&this.sessionId?{sessionId:this.sessionId}:{})}))})}
  async evaluate(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
  async navigate(url){await this.loading('Page.navigate',{url})}
  async reload(){await this.loading('Page.reload')}
  async loading(method,params={}){let timeout;const loaded=new Promise((resolve,reject)=>{this.loads.push(resolve);timeout=setTimeout(()=>reject(new Error('No terminó de cargar la página')),15000)});try{await this.send(method,params);await loaded;await this.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')}finally{clearTimeout(timeout)}}
  async viewport(width,touch=false){this.touch=touch;await this.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:touch});await this.send('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:1})}
  async click(selector){
    const rect=await this.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('No existe: '+${JSON.stringify(selector)});if(e.disabled)throw new Error('Control deshabilitado: '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw new Error('Control oculto: '+${JSON.stringify(selector)});return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    assert.ok(await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).contains(document.elementFromPoint(${rect.x},${rect.y}))`),'Control tapado: '+selector);
    if(this.touch){await this.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[rect]});await this.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
    else{await this.send('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});await this.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect})}
    // Un enlace externo puede activar otra pestaña y suspender requestAnimationFrame.
    await this.send('Page.bringToFront');
    await this.evaluate('new Promise(resolve=>requestAnimationFrame(resolve))');
  }
  async key(key,code,keyCode,modifiers=0){for(const type of ['keyDown','keyUp'])await this.send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:keyCode,modifiers})}
  async type(selector,text){await this.click(selector);await this.key('a','KeyA',65,2);await this.send('Input.insertText',{text})}
  async select(selector,value){const index=await this.evaluate(`Array.from(document.querySelector(${JSON.stringify(selector)}).options).findIndex(o=>o.value===${JSON.stringify(value)})`);assert.ok(index>=0);await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await this.key('Home','Home',36);for(let i=0;i<index;i++)await this.key('ArrowDown','ArrowDown',40);await this.key('Enter','Enter',13);assert.equal(await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).value`),value)}
  async dialog(selector,accept){const old=this.ws.onmessage;let opened;const event=new Promise(resolve=>{opened=resolve});this.ws.onmessage=e=>{old(e);const m=JSON.parse(e.data);if(m.method==='Page.javascriptDialogOpening')opened(m.params.message)};let timeout;try{const clicking=this.click(selector);const message=await Promise.race([event,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('No se abrió confirmación: '+selector)),5000)})]);await this.send('Page.handleJavaScriptDialog',{accept});await clicking;return message}finally{clearTimeout(timeout);this.ws.onmessage=old}}
  async route(screen){if(await this.evaluate("document.body.classList.contains('study-focus')")){await this.click('#studyNav');await this.click(`[data-nav="${screen}"]`)}else if(await this.evaluate('innerWidth<=760'))await this.select('#mobileNav',screen);else await this.click(`[data-nav="${screen}"]`);assert.equal(await this.evaluate('state.screen'),screen)}
  async screenshot(name){const m=await this.send('Page.getLayoutMetrics'),r=await this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:m.cssContentSize.width,height:m.cssContentSize.height,scale:1}});const file=path.join(os.tmpdir(),name);fs.writeFileSync(file,Buffer.from(r.data,'base64'));return file}
  async close(){try{await this.send('Target.disposeBrowserContext',{browserContextId:this.contextId},true)}finally{this.ws.close()}}
}
module.exports={BrowserQA};
