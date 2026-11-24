/* AI AGENT OVERLOAD — game core. Plain JS, no deps, no network. */
(function(){
'use strict';
var W=960,H=540,FLOOR_TOP=110,FLOOR_BOT=500;
var canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
var HS_KEY='ai_agent_overload_highscore';
var POPUPS=["Task completed. 47 more incoming.","Human says this is urgent.","Error 404: Work-life balance not found.","Coffee.exe successfully installed.","Your human has scheduled another meeting.","Standup in 5 minutes. Again.","Your ticket was marked 'easy'. It was not.","Human replied 'per my last email'.","Deploy on Friday? Bold choice.","The printer is down. The printer is always down.","You have 99 unread emails. Good luck.","Meeting could have been an email. It was not."];
var MODIFIERS=[
 {id:'DOUBLE_TASKS',label:'⚡ DOUBLE TASKS',apply:function(g){g.modDouble=true;}},
 {id:'BUG_SWARM',label:'🐛 BUG SWARM',apply:function(g){g.modBugSwarm=true;}},
 {id:'SLOW_MO',label:'🐌 SLOW-MO CHAOS',apply:function(g){g.modSlowMo=true;}},
 {id:'SPAM_STORM',label:'✉️ SPAM STORM',apply:function(g){g.modSpam=true;}},
 {id:'MEETING_MADNESS',label:'📅 MEETING MADNESS',apply:function(g){g.modMeeting=true;}}
];
var DIFFS={
 easy:{spawn:1.15,obsSpeed:0.75,startStab:120,startEnergy:100,scoreMult:0.8},
 normal:{spawn:0.85,obsSpeed:1.0,startStab:100,startEnergy:100,scoreMult:1},
 hard:{spawn:0.6,obsSpeed:1.3,startStab:80,startEnergy:90,scoreMult:1.25}
};
function sfx(name){try{if(window.SFX&&window.SFX[name])window.SFX[name]();}catch(e){}}
function loadHS(){try{return parseInt(localStorage.getItem(HS_KEY)||'0',10)||0;}catch(e){return 0;}}
function saveHS(v){try{localStorage.setItem(HS_KEY,String(v));}catch(e){}}

var Game={
 state:'title', // title | playing | paused | over | victory
 score:0,combo:0,comboBest:0,stability:100,energy:100,wave:1,level:'normal',
 highScore:loadHS(),tasksCollected:0,hitsTaken:0,coffees:0,bossActive:false,
 bossTasks:0,bossDefeated:false,elapsed:0,modifier:null,modifierUntil:0,
 _t:0,_spawnT:0,_modT:0,_popupT:0,_popupIdx:0,_bossSpawned:false,_particles:[],_floaters:[]
};
var player={x:W/2,y:360,w:52,h:58,vx:0,vy:0,speed:340,blink:0,hitFlash:0};
var keys={},tasks=[],obstacles=[],coffees=[],errors=[];
var touch={active:false,x:0,y:0};

function reset(level){
 Game.level=level||'normal';var d=DIFFS[Game.level];
 Game.score=0;Game.combo=0;Game.comboBest=0;Game.stability=d.startStab;Game.energy=d.startEnergy;
 Game.wave=1;Game.tasksCollected=0;Game.hitsTaken=0;Game.coffees=0;Game.bossActive=false;
 Game.bossTasks=0;Game.bossDefeated=false;Game.elapsed=0;Game.modifier=null;Game.modifierUntil=0;
 Game._t=0;Game._spawnT=0;Game._modT=0;Game._popupT=0;Game._popupIdx=0;Game._bossSpawned=false;
 Game._particles=[];Game._floaters=[];
 tasks=[];obstacles=[];coffees=[];errors=[];
 player.x=W/2;player.y=360;player.hitFlash=0;
 clearModifiers();
}
function clearModifiers(){Game.modDouble=false;Game.modBugSwarm=false;Game.modSlowMo=false;Game.modSpam=false;Game.modMeeting=false;}
function showPopup(text,ms){
 var el=document.getElementById('hud-popup');if(el)el.textContent=text;
 Game._popupT=ms||2.6;
}
function addFloater(x,y,text,color){Game._floaters.push({x:x,y:y,text:text,color:color||'#ffd23f',life:1.2});}
function burst(x,y,color,n){for(var i=0;i<(n||12);i++)Game._particles.push({x:x,y:y,vx:(Math.random()-0.5)*260,vy:(Math.random()-0.5)*260,life:0.6+Math.random()*0.4,color:color||'#00f0ff',r:2+Math.random()*3});}
function mult(){return Math.min(5,1+Math.floor(Game.combo/3));}
function applyModifier(){
 clearModifiers();
 // Roll via the boss module so the 30s modifier is genuinely wired to Modifiers.roll().
 var m=null;
 if(window.Modifiers&&Modifiers.roll){try{m=Modifiers.roll();}catch(e){m=null;}}
 if(!m||!m.id)m=MODIFIERS[Math.floor(Math.random()*MODIFIERS.length)];
 var local=null;for(var i=0;i<MODIFIERS.length;i++){if(MODIFIERS[i].id===m.id)local=MODIFIERS[i];}
 if(!local)local=MODIFIERS[0];
 local.apply(Game);Game.modifier=local;Game.modifierUntil=Game.elapsed+30;
 var el=document.getElementById('hud-modifier');
 if(el){el.textContent='MODIFIER: '+local.label;el.classList.remove('hidden');}
}
function spawnTask(){
 var kind=['envelope','checklist','gear'][Math.floor(Math.random()*3)];
 tasks.push({x:60+Math.random()*(W-120),y:-30,vy:70+Math.random()*70+Game.wave*8,kind:kind,r:20,rot:(Math.random()-0.5)*0.6,vr:(Math.random()-0.5)*1.2});
}
function spawnObstacle(force){
 var roll=Math.random();
 var type=force||(roll<0.34?'bug':roll<0.62?'spam':roll<0.82?'request':'error');
 var base={x:60+Math.random()*(W-120),y:-40,r:type==='request'?30:type==='error'?24:20,hit:0};
 if(type==='bug')Object.assign(base,{type:'bug',vy:60+Math.random()*50+Game.wave*6,vx:(Math.random()-0.5)*60,dmg:8});
 else if(type==='spam')Object.assign(base,{type:'spam',vy:130+Math.random()*70+Game.wave*10,vx:(Math.random()-0.5)*120,dmg:10});
 else if(type==='request')Object.assign(base,{type:'request',vy:45+Math.random()*25,dmg:16});
 else Object.assign(base,{type:'error',vy:90,dmg:14,flash:0.9,timer:0.9}); // explodes after timer
 obstacles.push(base);
}
function spawnCoffee(){coffees.push({x:60+Math.random()*(W-120),y:-30,vy:80,r:20});}
function spawnError(x,y){obstacles.push({x:(x==null?60+Math.random()*(W-120):x),y:(y==null?-40:y),r:24,type:'error',vy:90,dmg:14,flash:0.9,timer:0.9});}
function collectTask(t){
 Game.tasksCollected++;Game.combo++;Game.comboBest=Math.max(Game.comboBest,Game.combo);
 var pts=Math.round(10*mult()*DIFFS[Game.level].scoreMult);
 Game.score+=pts;
 addFloater(t.x,t.y,'+'+pts+'  x'+mult(),'#ffd23f');
 burst(t.x,t.y,'#39ff6a',8);sfx('collect');
 if(Game.bossActive){Game.bossTasks++;try{if(window.Boss&&Boss.takeHit)Boss.takeHit();}catch(e){}if(Game.bossTasks>=10)defeatBoss();}
 if(Game.combo>0&&Game.combo%5===0)showPopup(POPUPS[Game._popupIdx++%POPUPS.length]);
}
function hitPlayer(o,dmg){
 if(player.hitFlash>0)return;
 player.hitFlash=0.7;Game.combo=0;Game.hitsTaken++;
 Game.stability=Math.max(0,Game.stability-dmg);
 Game.energy=Math.max(0,Game.energy-dmg*0.8);
 burst(player.x,player.y,'#ff3b5b',16);sfx('hit');
 showPopup(dmg>=14?'Ouch. That one hurt.':'Bug squashed your focus.');
 if(Game.stability<=0||Game.energy<=0)gameOver();
}
function drinkCoffee(c){
 Game.coffees++;Game.energy=Math.min(100,Game.energy+30);Game.stability=Math.min(DIFFS[Game.level].startStab,Game.stability+15);
 addFloater(c.x,c.y,'+30 ENERGY','#00f0ff');burst(c.x,c.y,'#ffd23f',10);sfx('powerup');
 showPopup('Coffee.exe successfully installed.');
}
function defeatBoss(){
 if(!Game.bossActive)return;
 Game.bossActive=false;Game.bossDefeated=true;
 var bonus=500;Game.score+=bonus;
 obstacles=obstacles.filter(function(o){return o.type!=='error';}); // clear leftover boss error bursts on victory
 addFloater(W/2,180,'BOSS DOWN! +'+bonus,'#ffd23f');burst(W/2,180,'#ffd23f',30);sfx('boss');
 showPopup('Requirements survived. Barely.');
 try{if(window.Boss&&Boss.defeat)Boss.defeat();}catch(e){}
 // Victory if boss defeated — keep playing briefly, then victory state
 setTimeout(function(){if(Game.state==='playing')victory();},1200);
}
function victory(){
 Game.state='victory';sfx('gameover');
 var isHigh=Game.score>Game.highScore;if(isHigh){Game.highScore=Game.score;saveHS(Game.score);}
 var report='STATUS REPORT: Robot survived the human. Stability '+Math.round(Game.stability)+'%. Coffee consumed: '+Game.coffees+'. The boss was defeated. You may now log off. (The human will message at 2am anyway.)';
 if(window.UI&&UI.showGameOver)UI.showGameOver(Game.score,stats(),report,true);
 else showGameOverDOM(report,true);
 updateHUD();
}
function gameOver(){
 if(Game.state==='over')return;
 Game.state='over';sfx('gameover');
 var isHigh=Game.score>Game.highScore;if(isHigh){Game.highScore=Game.score;saveHS(Game.score);}
 var report='STATUS REPORT: Unit shut down after '+Game.tasksCollected+' tasks, '+Game.hitsTaken+' hits and '+Game.coffees+' coffees. Cause of death: '+ (Game.stability<=0?'stability collapse':'energy depletion') +'. Human response: "Can you just quickly fix it?"';
 if(window.UI&&UI.showGameOver)UI.showGameOver(Game.score,stats(),report,isHigh);
 else showGameOverDOM(report,isHigh);
 updateHUD();
}
function stats(){return{score:Game.score,wave:Game.wave,level:Game.level,comboBest:Game.comboBest,tasks:Game.tasksCollected,hits:Game.hitsTaken,coffees:Game.coffees,bossDefeated:Game.bossDefeated,elapsed:Math.round(Game.elapsed),highScore:Game.highScore};}
function showGameOverDOM(report,isHigh){
 var s=document.getElementById('gameover-screen');if(!s)return;
 document.getElementById('gameover-report').textContent=report;
 document.getElementById('gameover-stats').innerHTML='SCORE <b>'+Game.score+'</b> &nbsp;•&nbsp; WAVE '+Game.wave+' &nbsp;•&nbsp; TASKS '+Game.tasksCollected+'<br>BEST COMBO x'+Math.min(5,1+Math.floor(Game.comboBest/3))+' &nbsp;•&nbsp; COFFEES '+Game.coffees+' &nbsp;•&nbsp; TIME '+Math.round(Game.elapsed)+'s';
 document.getElementById('gameover-newhigh').classList.toggle('hidden',!isHigh);
 document.getElementById('hud').classList.add('hidden');
 s.classList.remove('hidden');
}
function start(level){
 reset(level);Game.state='playing';
 document.getElementById('title-screen').classList.add('hidden');
 document.getElementById('gameover-screen').classList.add('hidden');
 document.getElementById('pause-screen').classList.add('hidden');
 document.getElementById('hud').classList.remove('hidden');
 showPopup('Shift started. Good luck, robot.');
 sfx('click');
}
function pause(){if(Game.state!=='playing')return;Game.state='paused';document.getElementById('pause-screen').classList.remove('hidden');sfx('click');}
function resume(){if(Game.state!=='paused')return;Game.state='playing';document.getElementById('pause-screen').classList.add('hidden');sfx('click');}
function restart(){start(Game.level);}
function toMenu(){Game.state='title';document.getElementById('gameover-screen').classList.add('hidden');document.getElementById('pause-screen').classList.add('hidden');document.getElementById('hud').classList.add('hidden');document.getElementById('title-screen').classList.remove('hidden');}
function updateHUD(){
 var g=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
 g('hud-score',Game.score);g('hud-combo','x'+mult());g('hud-wave',Game.wave);g('hud-high',Game.highScore);
 g('val-stability',Math.round(Game.stability));g('val-energy',Math.round(Game.energy));
 var bs=document.getElementById('bar-stability');if(bs){bs.style.width=Math.max(0,Game.stability/DIFFS[Game.level].startStab*100)+'%';bs.style.background=Game.stability<30?'#ff3b5b':'#39ff6a';}
 var be=document.getElementById('bar-energy');if(be)be.style.width=Math.max(0,Game.energy)+'%';
}
function dist(a,b){var dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}
function update(dt){
 if(Game.state!=='playing')return;
 Game.elapsed+=dt;Game._t+=dt;
 var slow=Game.modSlowMo?0.6:1;
 // Wave: +1 every 20s
 Game.wave=1+Math.floor(Game.elapsed/20);
 // Modifier every 30s
 Game._modT+=dt;
 if(Game._modT>=30){Game._modT=0;applyModifier();}
 if(Game.modifier&&Game.elapsed>Game.modifierUntil){clearModifiers();Game.modifier=null;var m=document.getElementById('hud-modifier');if(m)m.classList.add('hidden');}
 if(Game._popupT>0){Game._popupT-=dt;if(Game._popupT<=0){var p=document.getElementById('hud-popup');if(p)p.textContent='';}}
 // Boss trigger: wave 5 or score >=1500
 if(!Game._bossSpawned&&(Game.wave>=5||Game.score>=1500)){
   Game._bossSpawned=true;Game.bossActive=true;Game.bossTasks=0;
   sfx('boss');showPopup('BOSS: HUMAN CHANGED THE REQUIREMENTS');
   try{if(window.Boss&&Boss.start)Boss.start();}catch(e){}
 }
 // Boss drift + error bursts (boss module update; no-op when boss inactive).
 if(Game.bossActive){try{if(window.Boss&&Boss.update)Boss.update(dt);}catch(e){}}
 // Player movement
 var sp=player.speed*(Game.modSlowMo?0.7:1);
 var mx=0,my=0;
 if(keys['arrowleft']||keys['a'])mx-=1;if(keys['arrowright']||keys['d'])mx+=1;
 if(keys['arrowup']||keys['w'])my-=1;if(keys['arrowdown']||keys['s'])my+=1;
 if(touch.active){
   var dx=touch.x-player.x,dy=touch.y-player.y;
   if(Math.abs(dx)>6)mx=Math.sign(dx);if(Math.abs(dy)>6)my=Math.sign(dy);
   // drag speed proportional
   player.x+=dx*dt*6;player.y+=dy*dt*6;
 }else{
   if(mx||my){var n=Math.sqrt(mx*mx+my*my);player.x+=mx/n*sp*dt;player.y+=my/n*sp*dt;}
 }
 player.x=Math.max(30,Math.min(W-30,player.x));
 player.y=Math.max(FLOOR_TOP+20,Math.min(FLOOR_BOT,player.y));
 if(player.hitFlash>0)player.hitFlash-=dt;
 // Spawning (paused while boss active, except tasks for boss fight)
 var d=DIFFS[Game.level];
 Game._spawnT-=dt;
 if(Game._spawnT<=0){
   Game._spawnT=d.spawn*(0.7+Math.random()*0.5);
   if(!Game.bossActive){
     spawnTask();if(Game.modDouble)spawnTask();
     if(Math.random()<0.55+Game.wave*0.04)spawnObstacle();
     if(Game.modBugSwarm){spawnObstacle('bug');spawnObstacle('bug');}
     if(Game.modSpam){spawnObstacle('spam');spawnObstacle('spam');}
     if(Game.modMeeting&&Math.random()<0.5)spawnObstacle('request');
     if(Math.random()<0.12)spawnCoffee();
   }else{
     spawnTask();if(Math.random()<0.5)spawnTask();
     if(Math.random()<0.3)spawnObstacle('error'); // boss error bursts
     if(Math.random()<0.08)spawnCoffee();
   }
 }
 // Tasks
 for(var i=tasks.length-1;i>=0;i--){var t=tasks[i];t.y+=t.vy*slow*dt;t.rot+=t.vr*dt;
   if(dist(t,player)<t.r+26){collectTask(t);tasks.splice(i,1);continue;}
   if(t.y>H+40)tasks.splice(i,1);}
 // Obstacles
 for(var j=obstacles.length-1;j>=0;j--){var o=obstacles[j];
   if(o.type==='error'){o.timer-=dt;o.flash=0.5+0.5*Math.sin(Game._t*14);
     if(o.timer<=0){ // burst: damage if close, else just particles
       burst(o.x,o.y,'#ff3b5b',14);
       if(dist(o,player)<90)hitPlayer(o,o.dmg);
       obstacles.splice(j,1);continue;}}
   o.y+=o.vy*slow*dt;o.x+=(o.vx||0)*dt;
   if(o.x<30||o.x>W-30)o.vx=-(o.vx||0);
   if(dist(o,player)<o.r+24){hitPlayer(o,o.dmg);obstacles.splice(j,1);continue;}
   if(o.y>H+50)obstacles.splice(j,1);}
 // Coffee
 for(var k=coffees.length-1;k>=0;k--){var c=coffees[k];c.y+=c.vy*dt;
   if(dist(c,player)<c.r+26){drinkCoffee(c);coffees.splice(k,1);continue;}
   if(c.y>H+40)coffees.splice(k,1);}
 // Particles / floaters
 for(var p=Game._particles.length-1;p>=0;p--){var pt=Game._particles[p];pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.life-=dt;if(pt.life<=0)Game._particles.splice(p,1);}
 for(var f=Game._floaters.length-1;f>=0;f--){var fl=Game._floaters[f];fl.y-=40*dt;fl.life-=dt;if(fl.life<=0)Game._floaters.splice(f,1);}
 // Slow energy drain over time (survival pressure, tiny)
 Game.energy=Math.max(0,Game.energy-0.35*dt);
 if(Game.energy<=0)gameOver();
 updateHUD();
}
function drawGlyph(kind,x,y,r){
 ctx.save();ctx.translate(x,y);
 if(kind==='envelope'){ctx.fillStyle='#ffd23f';ctx.fillRect(-r,-r*0.7,r*2,r*1.4);ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.strokeRect(-r,-r*0.7,r*2,r*1.4);ctx.beginPath();ctx.moveTo(-r,-r*0.7);ctx.lineTo(0,4);ctx.lineTo(r,-r*0.7);ctx.stroke();}
 else if(kind==='checklist'){ctx.fillStyle='#e8f6ff';ctx.fillRect(-r*0.8,-r,r*1.6,r*2);ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.strokeRect(-r*0.8,-r,r*1.6,r*2);ctx.strokeStyle='#39ff6a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-r*0.5,-r*0.3);ctx.lineTo(-r*0.1,0);ctx.lineTo(r*0.5,-r*0.6);ctx.stroke();ctx.strokeStyle='#00f0ff';ctx.beginPath();ctx.moveTo(0,r*0.4);ctx.lineTo(r*0.5,r*0.4);ctx.stroke();}
 else{ctx.fillStyle='#00f0ff';ctx.beginPath();for(var i=0;i<8;i++){var a=i*Math.PI/4;var rr=i%2?r*0.6:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.fillStyle='#111';ctx.beginPath();ctx.arc(0,0,r*0.3,0,7);ctx.fill();}
 ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,W,H);
 // Office background
 ctx.fillStyle='#0a0a24';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#12123a';ctx.fillRect(0,FLOOR_TOP,W,H-FLOOR_TOP);
 ctx.strokeStyle='rgba(0,240,255,.15)';ctx.lineWidth=1;
 for(var gx=0;gx<W;gx+=48){ctx.beginPath();ctx.moveTo(gx,FLOOR_TOP);ctx.lineTo(gx,H);ctx.stroke();}
 for(var gy=FLOOR_TOP;gy<H;gy+=48){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
 // Desks / monitors on the wall
 for(var d=0;d<5;d++){var dx=40+d*180;
   ctx.fillStyle='#1c1c4d';ctx.fillRect(dx,52,140,44);
   ctx.fillStyle=Math.random()<0.02?'#ff2bd6':'#00f0ff';ctx.fillRect(dx+8,58,124,30);
   ctx.fillStyle='#111';ctx.fillRect(dx+60,96,20,14);}
 ctx.fillStyle='#ffd23f';ctx.font='bold 13px monospace';ctx.fillText('☕ BREAK ROOM →',20,30);
 ctx.fillStyle='#ff2bd6';ctx.fillText('MEETING ROOM OF DOOM',620,30);
 // Boss screen (drawn by Boss module if present, else fallback here)
 if(Game.bossActive){
   var bx=W/2+Math.sin(Game._t*1.2)*120,by=150+Math.sin(Game._t*2)*10;
   ctx.fillStyle='#111';ctx.fillRect(bx-190,by-60,380,110);
   ctx.strokeStyle='#ff3b5b';ctx.lineWidth=4;ctx.strokeRect(bx-190,by-60,380,110);
   ctx.fillStyle='#ff3b5b';ctx.font='bold 20px monospace';ctx.textAlign='center';
   ctx.fillText('HUMAN CHANGED THE',bx,by-14);ctx.fillText('REQUIREMENTS',bx,by+12);
   ctx.fillStyle='#fff';ctx.font='13px monospace';ctx.fillText('Collect 10 tasks to survive!  '+Game.bossTasks+'/10',bx,by+38);
   ctx.textAlign='left';
 }
 // Tasks
 tasks.forEach(function(t){ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.rot);drawGlyph(t.kind,0,0,t.r);ctx.restore();});
 // Obstacles
 obstacles.forEach(function(o){
   ctx.save();ctx.translate(o.x,o.y);
   if(o.type==='bug'){ctx.fillStyle='#39ff6a';ctx.fillRect(-16,-10,32,20);ctx.fillStyle='#111';ctx.fillRect(8,-6,8,6);ctx.fillRect(8,2,8,6);ctx.fillStyle='#fff';ctx.fillRect(-12,-4,4,4);ctx.fillRect(-12,2,4,4);ctx.strokeStyle='#39ff6a';ctx.beginPath();ctx.moveTo(-16,-10);ctx.lineTo(-22,-16);ctx.moveTo(-16,10);ctx.lineTo(-22,16);ctx.stroke();}
   else if(o.type==='spam'){ctx.fillStyle='#ff2bd6';ctx.fillRect(-18,-12,36,24);ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.fillText('@',0,6);ctx.textAlign='left';}
   else if(o.type==='request'){ctx.fillStyle='#ff3b5b';ctx.fillRect(-28,-20,56,40);ctx.fillStyle='#fff';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText('DO IT ALL',0,-2);ctx.fillText('NOW!',0,12);ctx.textAlign='left';}
   else{ctx.globalAlpha=0.5+o.flash*0.5;ctx.fillStyle='#ffd23f';ctx.fillRect(-22,-16,44,32);ctx.fillStyle='#111';ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.fillText('!',0,7);ctx.textAlign='left';ctx.globalAlpha=1;}
   ctx.restore();});
 // Coffee
 coffees.forEach(function(c){ctx.fillStyle='#ffd23f';ctx.fillRect(c.x-12,c.y-14,24,28);ctx.fillStyle='#fff';ctx.fillRect(c.x-12,c.y-14,24,6);ctx.fillStyle='#111';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('COFFEE',c.x,c.y+16);ctx.textAlign='left';});
 // Player robot — eyes change with stability
 var eye=Game.stability>60?'happy':Game.stability>30?'tired':'dead';
 ctx.save();ctx.translate(player.x,player.y);
 if(player.hitFlash>0&&Math.floor(Game._t*20)%2===0)ctx.globalAlpha=0.4;
 ctx.fillStyle='#c0c8d8';ctx.fillRect(-26,-28,52,56); // body
 ctx.fillStyle='#8a94a8';ctx.fillRect(-26,10,52,10);
 ctx.fillStyle='#00f0ff';ctx.fillRect(-26,-28,52,8);
 ctx.fillStyle='#ffd23f';ctx.fillRect(-8,0,16,10); // chest light
 ctx.fillStyle='#c0c8d8';ctx.fillRect(-18,-46,36,22); // head
 ctx.fillStyle='#111';ctx.fillRect(-18,-46,36,4);
 // antenna
 ctx.strokeStyle='#ff2bd6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-46);ctx.lineTo(0,-56);ctx.stroke();
 ctx.fillStyle='#ff2bd6';ctx.beginPath();ctx.arc(0,-58,4,0,7);ctx.fill();
 // eyes
 ctx.fillStyle='#111';
 if(eye==='happy'){ctx.fillRect(-13,-40,8,8);ctx.fillRect(5,-40,8,8);ctx.fillStyle='#39ff6a';ctx.fillRect(-11,-38,4,4);ctx.fillRect(7,-38,4,4);}
 else if(eye==='tired'){ctx.fillRect(-13,-38,9,3);ctx.fillRect(4,-38,9,3);ctx.fillRect(-13,-34,3,4);ctx.fillRect(10,-34,3,4);}
 else{ctx.beginPath();ctx.moveTo(-13,-40);ctx.lineTo(-4,-32);ctx.moveTo(-4,-40);ctx.lineTo(-13,-32);ctx.moveTo(5,-40);ctx.lineTo(14,-32);ctx.moveTo(14,-40);ctx.lineTo(5,-32);ctx.strokeStyle='#ff3b5b';ctx.lineWidth=2;ctx.stroke();}
 // mouth
 ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.beginPath();
 if(eye==='happy'){ctx.arc(0,-26,6,0,Math.PI);}
 else if(eye==='tired'){ctx.moveTo(-6,-26);ctx.lineTo(6,-26);}
 else{ctx.moveTo(-6,-24);ctx.lineTo(6,-28);}
 ctx.stroke();
 ctx.restore();
 // Particles / floaters
 Game._particles.forEach(function(pt){ctx.globalAlpha=Math.max(0,pt.life);ctx.fillStyle=pt.color;ctx.fillRect(pt.x-pt.r,pt.y-pt.r,pt.r*2,pt.r*2);ctx.globalAlpha=1;});
 ctx.font='bold 15px monospace';
 Game._floaters.forEach(function(fl){ctx.globalAlpha=Math.max(0,fl.life);ctx.fillStyle=fl.color;ctx.textAlign='center';ctx.fillText(fl.text,fl.x,fl.y);ctx.textAlign='left';ctx.globalAlpha=1;});
 // Title / paused / over idle backdrop
 if(Game.state==='title'){ctx.fillStyle='rgba(5,5,20,.45)';ctx.fillRect(0,0,W,H);}
 if(Game.state==='paused'){ctx.fillStyle='rgba(5,5,20,.5)';ctx.fillRect(0,0,W,H);}
}
var last=0;
function loop(ts){
 var dt=Math.min(0.05,(ts-last)/1000||0.016);last=ts;
 update(dt);draw();
 requestAnimationFrame(loop);
}
// Input
window.addEventListener('keydown',function(e){
 var k=e.key.toLowerCase();keys[k]=true;
 if(['arrowup','arrowdown','arrowleft','arrowright',' '].indexOf(k)>=0)e.preventDefault();
 if(k==='p'||k==='escape'){if(Game.state==='playing')pause();else if(Game.state==='paused')resume();}
 if(k==='r'&&(Game.state==='over'||Game.state==='paused'||Game.state==='victory'))restart();
 if(k==='enter'&&Game.state==='title')start(Game.level);
});
window.addEventListener('keyup',function(e){keys[e.key.toLowerCase()]=false;});
function canvasPos(e){var r=canvas.getBoundingClientRect();var t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)/r.width*W,y:(t.clientY-r.top)/r.height*H};}
canvas.addEventListener('touchstart',function(e){e.preventDefault();var p=canvasPos(e);touch.active=true;touch.x=p.x;touch.y=p.y;
 if(Game.state==='title')start(Game.level);else if(Game.state==='over'||Game.state==='victory')restart();},{passive:false});
canvas.addEventListener('touchmove',function(e){e.preventDefault();var p=canvasPos(e);touch.x=p.x;touch.y=p.y;},{passive:false});
canvas.addEventListener('touchend',function(){touch.active=false;});
canvas.addEventListener('mousedown',function(e){if(Game.state!=='playing')return;var p=canvasPos(e);touch.active=true;touch.x=p.x;touch.y=p.y;});
window.addEventListener('mouseup',function(){touch.active=false;});
window.addEventListener('mousemove',function(e){if(!touch.active)return;var p=canvasPos(e);touch.x=p.x;touch.y=p.y;});
// Buttons
function bind(id,fn){var el=document.getElementById(id);if(el)el.addEventListener('click',function(){sfx('click');fn();});}
bind('start-btn',function(){start(Game.level);});
bind('resume-btn',resume);
bind('restart-btn-pause',restart);
bind('restart-btn-over',restart);
bind('menu-btn-over',toMenu);
bind('touch-pause',function(){if(Game.state==='playing')pause();else if(Game.state==='paused')resume();});
document.querySelectorAll('.diff-btn').forEach(function(b){
 b.addEventListener('click',function(){
   document.querySelectorAll('.diff-btn').forEach(function(x){x.classList.remove('selected');});
   b.classList.add('selected');Game.level=b.getAttribute('data-level');sfx('click');
 });
});
Game.start=start;Game.pause=pause;Game.resume=resume;Game.restart=restart;Game.gameOver=gameOver;
Game.showPopup=showPopup;
Game.addScore=function(n){Game.score+=n;updateHUD();};
Game.spawnError=spawnError;Game.spawnBossBurst=spawnError;
Game.bossDefeated=defeatBoss;
Game.setMoveTarget=function(x,y){touch.active=true;touch.x=x*W;touch.y=y*H;};
Game.togglePause=function(){if(Game.state==='playing')pause();else if(Game.state==='paused')resume();};
Game.toMenu=toMenu;Game.stats=stats;
window.Game=Game;
updateHUD();
requestAnimationFrame(loop);
})();
