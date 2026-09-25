(function(){
 'use strict';
 const root=document.getElementById('avatar-demo'),canvas=document.getElementById('stage'),ctx=canvas.getContext('2d');
 const status=document.getElementById('status'),error=document.getElementById('error');
 const specs={
  walk:{src:'assets/arshad-walk.png',w:172,h:330,cols:9,rows:2,ax:86,fy:318},
  jump:{src:'assets/arshad-jump.png',w:224,h:330,cols:9,rows:2,ax:112,fy:318},
  turn:{src:'assets/arshad-turn.png',w:176,h:330,cols:9,rows:1,ax:88,fy:318},
  airTurn:{src:'assets/arshad-air-turn.png',w:224,h:330,cols:9,rows:1,ax:112,fy:318}
 };
 const buttons=[...root.querySelectorAll('button')],keys=new Set(),abort=new AbortController();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const engine=new AvatarMotion({reducedMotion:reduced.matches});
 let ready=false,raf=null,last=null,width=720,lastStatus='';
 const height=460,floor=438;
 const on=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:abort.signal});
 function resize(){
  width=Math.max(224,Math.round(canvas.getBoundingClientRect().width));
  const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;engine.resize(width);draw();
 }
 function draw(){
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#7182a1';ctx.fillRect(0,floor,width,1);
  if(!ready)return;
  const f=engine.frame(),s=specs[f.sheet];
  if(engine.target!==null){ctx.fillStyle='#ffad79';ctx.fillRect(Math.round(engine.target)-4,floor+8,8,3);}
  ctx.drawImage(s.image,f.column*s.w,f.row*s.h,s.w,s.h,Math.round(engine.x-s.ax),Math.round(floor-s.fy+engine.y),s.w,s.h);
  const action=engine.turning?(engine.mode==='air'?'Turning in mid-air':'Turning'):engine.mode==='ground'?(engine.moving?'Walking':'Ready'):engine.mode;
  const text=action+' · '+(engine.desired>0?'right':'left');
  if(text!==lastStatus){status.textContent=text;lastStatus=text;}
  canvas.dataset.state=engine.mode;canvas.dataset.sheet=f.sheet;canvas.dataset.frame=f.column;canvas.dataset.x=engine.x.toFixed(2);canvas.dataset.y=engine.y.toFixed(2);
 }
 function run(){if(ready&&raf===null){last=null;raf=requestAnimationFrame(tick);}}
 function tick(time){raf=null;const dt=last===null?0:Math.min((time-last)/1000,.05);last=time;engine.update(dt);draw();if(engine.active||engine.moving)raf=requestAnimationFrame(tick);else last=null;}
 function stop(){keys.clear();engine.cancel();if(raf!==null)cancelAnimationFrame(raf);raf=null;last=null;draw();}
 function keyMove(){engine.move(Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')));}
 function jump(turn=false){keys.clear();engine.move(0);if(!engine.jump(turn)&&reduced.matches){status.textContent='Jump disabled by your reduced-motion preference.';return;}run();}
 on(document.getElementById('left'),'click',()=>{keys.clear();engine.goTo(engine.limits()[0]);run();});
 on(document.getElementById('right'),'click',()=>{keys.clear();engine.goTo(engine.limits()[1]);run();});
 on(document.getElementById('jump'),'click',()=>jump());
 on(document.getElementById('turn'),'click',()=>{keys.clear();engine.move(0);engine.turn();run();});
 on(document.getElementById('jump-turn'),'click',()=>{engine.target=null;jump(true);});
 on(root,'keydown',event=>{
  if(!ready||event.ctrlKey||event.metaKey||event.altKey||event.target.isContentEditable||event.target.closest('input,textarea,select'))return;
  if(event.code==='Escape'){event.preventDefault();stop();return;}
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(event.code)){event.preventDefault();keys.add(event.code);keyMove();run();}
  else if(['Space','KeyW','ArrowUp'].includes(event.code)){event.preventDefault();if(!event.repeat){engine.jump();run();}}
 });
 on(window,'keyup',event=>{keys.delete(event.code);keyMove();});
 on(canvas,'pointerdown',event=>{
  if(!ready||!event.isPrimary||event.button!==0)return;
  document.getElementById('left').focus({preventScroll:true});keys.clear();
  const box=canvas.getBoundingClientRect();engine.goTo((event.clientX-box.left)*width/box.width);run();
 });
 on(root,'focusout',()=>queueMicrotask(()=>{if(!root.contains(document.activeElement))stop();}));
 on(window,'blur',stop);on(document,'visibilitychange',()=>{if(document.hidden)stop();});on(window,'pagehide',stop);
 on(reduced,'change',()=>{engine.reducedMotion=reduced.matches;stop();});
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 Promise.all(Object.values(specs).map(s=>new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>{if(image.naturalWidth!==s.w*s.cols||image.naturalHeight!==s.h*s.rows)reject(new Error('Unexpected dimensions: '+s.src));else{s.image=image;resolve();}};
  image.onerror=()=>reject(new Error('Could not load '+s.src+'. Extract the ZIP and keep the folders together.'));image.src=s.src;
 }))).then(()=>{ready=true;buttons.forEach(b=>b.disabled=false);draw();}).catch(e=>{error.textContent=e.message;status.textContent='Assets unavailable';});
 // Call on component unmount when adapting this controller to a framework.
 window.destroyAvatarDemo=()=>{stop();abort.abort();observer.disconnect();};
})();
