/* Shared state machine: browser demo, previews and deterministic validation. */
(function(global){
 'use strict';
 class AvatarMotion {
  constructor({width=720,reducedMotion=false}={}){
   this.width=width;this.x=Math.min(180,width/2);this.direction=1;this.angle=6;this.desired=1;
   this.input=0;this.target=null;this.mode='ground';this.elapsed=0;this.y=0;this.walkPhase=0;
   this.moving=false;this.turning=false;this.autoTurn=false;this.reducedMotion=reducedMotion;
   this.speed=150;this.gravity=1125;this.launchSpeed=450;this.airtime=2*this.launchSpeed/this.gravity;
   this.turnDuration=.4;this.turnGoal=6;this.turnStart=6;this.turnElapsed=0;this.currentTurnDuration=.4;
  }
  limits(){return[112,Math.max(112,this.width-112)];}
  clamp(value){const[a,b]=this.limits();return Math.min(b,Math.max(a,value));}
  resize(width){this.width=width;this.x=this.clamp(this.x);if(this.target!==null)this.target=this.clamp(this.target);}
  move(direction){this.input=Math.sign(direction);if(direction)this.target=null;}
  goTo(x){this.input=0;this.target=this.clamp(x);}
  turn(){this.desired=-this.desired;this.target=null;}
  jump(withTurn=false){
   if(this.mode!=='ground'||this.reducedMotion)return false;
   this.mode='anticipation';this.elapsed=0;this.autoTurn=withTurn;return true;
  }
  cancel(){
   this.input=0;this.target=null;this.mode='ground';this.elapsed=0;this.y=0;this.walkPhase=0;
   this.moving=false;this.turning=false;this.autoTurn=false;this.angle=this.desired>0?6:2;this.direction=this.desired;this.turnGoal=this.angle;this.turnStart=this.angle;this.turnElapsed=0;
  }
  update(dt){
   dt=Math.max(0,Math.min(dt,.05));
   let intent=this.input;
   if(!intent&&this.target!==null){const delta=this.target-this.x;if(Math.abs(delta)<.01){this.x=this.target;this.target=null;}else intent=Math.sign(delta);}
   if(intent)this.desired=intent;
   if(this.mode!=='ground'){
    this.elapsed+=dt;
    if(this.mode==='anticipation'&&this.elapsed>=.12){this.mode='air';this.elapsed=0;}
    if(this.mode==='air'){
     if(this.autoTurn&&this.elapsed>=.16){this.desired=-this.desired;this.autoTurn=false;}
     this.y=-(this.launchSpeed*this.elapsed-.5*this.gravity*this.elapsed*this.elapsed);
     if(this.elapsed>=this.airtime){this.mode='landing';this.elapsed=0;this.y=0;}
    }else if(this.mode==='landing'&&this.elapsed>=.12){this.mode='recovery';this.elapsed=0;}
    else if(this.mode==='recovery'&&this.elapsed>=.12){this.mode='ground';this.elapsed=0;}
   }
   const goal=this.desired>0?6:2;
   if(goal!==this.turnGoal){this.turnGoal=goal;this.turnStart=this.angle;this.turnElapsed=0;this.currentTurnDuration=Math.max(.08,this.turnDuration*Math.abs(goal-this.angle)/4);}
   if(this.reducedMotion)this.angle=goal;
   else if(this.angle!==goal){this.turnElapsed+=dt;const p=Math.min(1,this.turnElapsed/this.currentTurnDuration),e=p*p*(3-2*p);this.angle=this.turnStart+(goal-this.turnStart)*e;}
   this.turning=Math.abs(this.angle-goal)>.0001;
   if(!this.turning)this.direction=this.desired;
   const previous=this.x;
   const canMove=(this.mode==='ground'&&!this.turning)||this.mode==='air';
   if(intent&&canMove){
    const distance=this.target!==null&&!this.input?Math.min(Math.abs(this.target-this.x),this.speed*dt):this.speed*dt;
    this.x=this.clamp(this.x+intent*distance);
    if(this.target!==null&&Math.abs(this.target-this.x)<.01){this.x=this.target;this.target=null;}
   }
   this.moving=Math.abs(this.x-previous)>.0001;
   if(this.moving&&this.mode==='ground')this.walkPhase=(this.walkPhase+Math.abs(this.x-previous)/120)%1;
   else this.walkPhase=0;
   return this.frame();
  }
  frame(){
   if(this.turning)return{sheet:this.mode==='air'?'airTurn':'turn',column:Math.round(this.angle),row:0};
   const row=this.direction>0?0:1;
   if(this.mode!=='ground'){
    let column=1;
    if(this.mode==='air'){
     const p=this.elapsed/this.airtime;
     column=p<.13?2:p<.36?3:p<.61?4:p<.84?5:6;
    }else if(this.mode==='landing')column=7;else if(this.mode==='recovery')column=8;
    return{sheet:'jump',column,row};
   }
   return{sheet:'walk',column:this.moving&&!this.reducedMotion?1+Math.floor(this.walkPhase*8):0,row};
  }
  get active(){return this.input!==0||this.target!==null||this.turning||this.mode!=='ground'||Math.abs(this.angle-(this.desired>0?6:2))>.0001;}
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={AvatarMotion};
 else global.AvatarMotion=AvatarMotion;
})(typeof window!=='undefined'?window:globalThis);
