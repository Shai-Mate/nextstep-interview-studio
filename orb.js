'use strict';
/* Liquid-light orb. WebGL 1: no libraries, no images, no video, no network.

   #aurora (Canvas 2D) is the page light: one warm source at the top left, a slow
   diagonal sheen and drifting motes.

   #orb (WebGL) sits behind the app and is drawn in two passes:
     1. a band of liquid light around the orb, and a ray-traced glass sphere that
        refracts it, with a marbled colour core, one soft round glint, a warm rim
        strip, a caustic and an expanding pulse ring;
     2. 2,600 molecules that blow away downwind and spiral back together, and the
        burst of light for celebrate().

   The orb follows the first element in #app that carries data-orb:
     data-env     strength of the light band around the orb, 0 to 1
     data-s       scale of the light band
     data-up      "a,b"  the band fades in between a and b px above the centre
     data-down    "a,b"  the band fades out between a and b px below the centre
     data-energy  strength of the colour core, 0 to 1 (the app passes progress)
     data-voice   "1" makes the orb the interviewer: it stays whole, and a white
                  core pulses with the syllables of the [data-say] element.
                  Tapping the orb replays them.

   window.NextStepOrb = { celebrate(), level(v), info() }:
     celebrate()  a burst of light and two rings once the orb has formed (queued while it travels).
     level(v)     an outside voice level 0..1 (read-aloud word boundaries, a microphone) that drives
                  the white core and the rings. Call it every frame to hold it; it fades on its own
                  and replaces the simulated syllables of [data-say] while it is active.
     info()       read-only diagnostics for QA.
   celebrate() and level() are no-ops under prefers-reduced-motion or while the page is hidden.

   Tapping an ordinary orb scatters it; tapping near it sends a pulse.
   Pauses while the tab is hidden. prefers-reduced-motion draws still frames only.
   orb-2d.js (Canvas 2D) takes over when WebGL is missing or software-only, when the shaders
   fail, when the first whole orb reads back empty, or when a lost context does not return.
   CSP-safe: no inline styles or scripts; element styles are set through el.style only. */
(function () {
  window.NextStepOrb = window.NextStepOrb || { celebrate() {}, level() {} };
  const aurora = document.getElementById('aurora');
  const stage = document.getElementById('orb');
  if (!aurora || !stage) return;
  const appRoot = document.getElementById('app');
  const pick = (sel) => (appRoot && appRoot.querySelector(sel)) || document.querySelector(sel);

  // Shared by both passes: value noise and the erosion order of the sphere.
  const NOISE = `
const vec3 WIND=vec3(.83,.45,.33);
float h31(vec3 p) {
  p=fract(p*vec3(.1031,.1030,.0973));
  p+=dot(p,p.yxz+33.33);
  return fract((p.x+p.y)*p.z);
}
float vn(vec3 p) {
  vec3 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1.,0.,0.)),f.x),mix(h31(i+vec3(0.,1.,0.)),h31(i+vec3(1.,1.,0.)),f.x),f.y),mix(mix(h31(i+vec3(0.,0.,1.)),h31(i+vec3(1.,0.,1.)),f.x),mix(h31(i+vec3(0.,1.,1.)),h31(i+vec3(1.,1.,1.)),f.x),f.y),f.z);
}
// Order in which the sphere erodes: noise, biased so the downwind side goes last.
float ero(vec3 n) {
  float a=vn(n*2.3+7.1)*.65+vn(n*5.3+3.7)*.35;
  return .06+.88*clamp(mix(a,dot(n,WIND)*.5+.5,.5),0.,1.);
}
`;

  const QUAD_VS = 'attribute vec2 aP;\nvoid main() {\n  gl_Position = vec4(aP, 0., 1.);\n}\n';

  // Pass 1: the light band, the pulse ring and the ray-traced glass sphere.
  // Coordinates are CSS pixels from the top left of the viewport.
  const GLASS_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes,uC,uPulse,uTilt,uBgS,uBgO,uCol;
uniform float uQ,uT,uR,uD,uEnv,uS,uCoreI,uCoreR,uOrbA,uFrame,uVoice;
uniform vec4 uBand;
uniform vec3 uKey,uStrip;
uniform mat3 uRot;
` + NOISE + `
const float TAU=6.2831853;
const float LB=3.4;
vec4 blob(vec2 P,float tt,vec3 col,float r,vec2 c0,vec2 am,vec2 fr,float ph,float a,float dd) {
  vec2 c=vec2(390.*(c0.x+2.3*am.x*sin(tt*fr.x*dd+ph)),460.*(c0.y-.11+2.3*am.y*cos(tt*fr.y*dd+ph*1.3)));
  vec2 v=(P-c)/r;
  float f=a*.75*exp(-4.4*dot(v,v));
  return vec4(col*f,f);
}
vec4 rib(float dy,float sl,vec3 col,float amp,float sig) {
  float d=dy/sqrt(1.+sl*sl);
  float f=amp*exp(-.5*d*d/(sig*sig));
  return vec4(col*f,f);
}
// Liquid light: five drifting blobs and five ribbons in a 390 x 460 field centred on the orb.
vec4 aurora(vec2 p) {
  vec2 P=(p-uC)/uS+vec2(195.,165.6);
  float t=uT;
  P+=16.*vec2(sin(P.y*.011+t*.31),cos(P.x*.009-t*.27));
  float tt=t*TAU*.7;
  vec4 a=vec4(0.);
  a+=blob(P,tt,vec3(1.,.62,.431),150.,vec2(.42,.46),vec2(.16,.08),vec2(.11,.17),0.,.85,1.);
  a+=blob(P,tt,vec3(.969,.769,.631),105.,vec2(.60,.40),vec2(.14,.10),vec2(.15,.09),1.7,.75,-1.);
  a+=blob(P,tt,vec3(.588,.314,.824),190.,vec2(.30,.55),vec2(.12,.12),vec2(.07,.12),3.1,.70,1.);
  a+=blob(P,tt,vec3(.902,.353,.549),140.,vec2(.72,.58),vec2(.12,.08),vec2(.13,.06),4.4,.60,-1.);
  a+=blob(P,tt,vec3(.431,.235,.745),170.,vec2(.75,.30),vec2(.10,.10),vec2(.05,.10),5.2,.55,1.);
  float tr=t*.65,x=P.x/390.;
  for(int j=0;j<3;j++) {
    float fj=float(j);
    float a1=x*5.+tr*1.05+fj*2.,a2=x*2.3-tr*.66+fj;
    float y=165.6+(fj-1.)*36.8+sin(a1)*54.+sin(a2)*40.;
    a+=rib(P.y-y,(cos(a1)*270.+cos(a2)*92.)/390.,vec3(1.,.706+fj*.078,.588+fj*.078),.16-fj*.055,19.);
  }
  float th=-.95+.2*sin(tr*.4);
  vec2 dq=P-vec2(195.,165.6);
  vec2 l=vec2(dq.x*cos(th)+dq.y*sin(th),-dq.x*sin(th)+dq.y*cos(th));
  float en=(1.-smoothstep(340.,420.,abs(l.x)));
  for(int j=0;j<2;j++) {
    float fj=float(j);
    float a3=l.x/390.*3.+3.-tr*1.4+3.*fj;
    a+=en*rib(l.y-((fj-.5)*138.+sin(a3)*46.),cos(a3)*.354,mix(vec3(.667,.392,.941),vec3(1.,.47,.667),fj),.138-fj*.069,19.);
  }
  return min(a,vec4(1.));
}
// The page background gradient, so the glass refracts what is really behind it.
vec3 bgc(vec2 p) {
  float t=length((p+uBgO)/uBgS);
  vec3 c0=vec3(.263,.125,.294),c1=vec3(.165,.071,.188),c2=vec3(.086,.031,.094),c3=vec3(.035,.012,.035);
  return t<.34?mix(c0,c1,t/.34):t<.66?mix(c1,c2,(t-.34)/.32):mix(c2,c3,min((t-.66)/.34,1.));
}
vec3 world(vec2 p) {
  vec4 a=aurora(p);
  return a.rgb+bgc(p)*(1.-a.a);
}
// Where a ray that enters the sphere at normal n lands on the backdrop.
vec2 rfo(vec3 n,float ior) {
  vec3 d1=refract(vec3(0.,0.,-1.),n,1./ior);
  float len=-2.*dot(n,d1);
  vec3 p1=n+d1*len;
  vec3 d2=refract(d1,-p1,ior);
  return p1.xy+d2.xy*((LB+p1.z)/max(-d2.z,.12));
}
// A soft rounded-rectangle light seen in reflection (the rim strip).
float sbox(vec3 r,vec3 L,vec2 hs,float rad,float soft) {
  float dl=dot(r,L);
  if(dl<.05)return 0.;
  vec3 U=normalize(cross(vec3(0.,1.,0.),L));
  vec3 V=cross(L,U);
  vec2 ab=vec2(dot(r,U),dot(r,V))/dl;
  vec2 d=abs(ab)-hs+rad;
  float sd=length(max(d,0.))+min(max(d.x,d.y),0.)-rad;
  return (1.-smoothstep(-soft,soft,sd))*(1.-.15*dot(ab/hs,ab/hs));
}
// Soft highlight roll-off.
vec3 sh(vec3 c) {
  return mix(c,.7+.3*(1.-exp(-(c-.7)/.3)),step(.7,c));
}
void main() {
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uQ;
  vec2 dv=p-uC;
  float dist=length(dv),rn=dist/uR;
  vec2 dir=dv/max(dist,1.);
  float form=1.-smoothstep(.15,1.,uD);
  float ring=0.;
  vec2 pd=p;
  for(int i=0;i<2;i++) {
    float age=i==0?uPulse.x:uPulse.y;
    float u=age/2.4;
    if(age>=0.&&u<1.) {
      float ez=1.-pow(1.-u,3.);
      float rr=uR*(.3+3.1*ez);
      float x=dist-rr;
      float fd=(1.-u)*(1.-u);
      ring+=(exp(-x*x/1.6)*.8+exp(-x*x/110.)*.14)*fd*smoothstep(uR*.99,uR*1.03,dist);
      pd+=dir*6.*fd*(x/12.)*exp(-x*x/288.);
    }
  }
  float m=smoothstep(uBand.x,uBand.y,p.y)*(1.-smoothstep(uBand.z,uBand.w,p.y))*uEnv*(1.-smoothstep(uCol.y,uCol.y+96.,abs(p.x-uCol.x)));
  vec4 col=vec4(0.);
  if(m>.003)col=aurora(pd)*m;
  if(rn>1.)col.rgb+=vec3(1.,.72,.5)*(exp(-(rn-1.)*3.4)*.2+exp(-(rn-1.)*1.1)*.045)*(uCoreI+uVoice*1.1)*form*uOrbA;
  col.rgb+=vec3(1.,.87,.76)*ring*uOrbA;
  float aa=clamp((uR-dist)*uQ/1.5+.5,0.,1.);
  if(aa>0.&&uOrbA>.002) {
    vec2 q=vec2(dv.x,-dv.y)/uR;
    float r2=dot(q,q);
    if(r2>.9992) {
      q*=sqrt(.9992/r2);
      r2=.9992;
    }
    vec3 n=vec3(q,sqrt(1.-r2));
    float e=ero(n);
    float ce=smoothstep(uD-.025,uD+.025,e);
    vec3 d1=refract(vec3(0.,0.,-1.),n,1./1.5);
    vec3 rd=normalize(mix(vec3(0.,0.,-1.),d1,ce));
    float b=-dot(n,rd);
    float d2c=max(1.-b*b,0.);
    float rc=uCoreR;
    vec3 xc=uRot*(n+rd*b);
    float gr=.86+.28*vn(xc*9.+vec3(0.,uT*.5,0.));
    float jit=fract(sin(dot(gl_FragCoord.xy+uFrame*17.,vec2(12.9898,78.233)))*43758.5453);
    vec3 wv=vec3(0.),Tf=vec3(1.),Ta=vec3(1.);
    for(int i=0;i<12;i++) {
      float s=(float(i)+jit)/12.*2.*b;
      vec3 x=uRot*(n+rd*s);
      float r=length(x);
      vec3 w=x/max(r,.05)*3.2+vec3(r*2.2-uT*.26);
      w+=1.1*sin(w.zxy*1.5+uT*.15);
      float g=dot(sin(w),cos(w.yzx));
      float fil=pow(clamp(1.-abs(g)*.85,0.,1.),2.4)*(1.-smoothstep(.62,1.,r))*smoothstep(.04,.26,r);
      float hu=.5+.5*sin(w.x*.8+w.z*.6+r*3.);
      vec3 vc=hu<.5?mix(vec3(1.,.63,.38),vec3(1.,.3,.5),hu*2.):mix(vec3(1.,.3,.5),vec3(.52,.3,1.),hu*2.-1.);
      float lit=.26+1.25*uCoreI/(1.+16.*r*r)+1.5*uVoice/(1.+9.*r*r);
      wv+=Ta*vc*fil*lit;
      vec3 ab=exp(-fil*(1.06-vc)*b*.4);
      Ta*=ab;
      if(i<6)Tf*=ab;
    }
    Tf=mix(vec3(1.),Tf,ce);
    vec3 em=(vec3(1.,.74,.5)*exp(-d2c/(rc*rc))*.52+vec3(1.,.4,.52)*exp(-d2c/(rc*rc*4.5))*.3+vec3(.6,.36,1.)*exp(-d2c/(rc*rc*14.))*.13)*gr*uCoreI*Tf;
    float rv=rc*(.55+.95*uVoice);
    em+=(vec3(1.,.96,.9)*exp(-d2c/(rv*rv))*1.35+vec3(1.,.6,.5)*exp(-d2c/(rv*rv*5.))*.45)*uVoice*gr*mix(vec3(1.),Tf,.5);
    em+=wv*(b/6.)*1.7*ce;
    vec3 g3=vec3(0.);
    if(ce>.001) {
      vec2 par=uTilt*uR*.35;
      vec2 o1=rfo(n,1.46),o2=rfo(n,1.5),o3=rfo(n,1.54);
      vec3 tr=vec3(world(uC+vec2(o1.x,-o1.y)*uR-par).r,world(uC+vec2(o2.x,-o2.y)*uR-par).g,world(uC+vec2(o3.x,-o3.y)*uR-par).b);
      tr=max(mix(vec3(dot(tr,vec3(.3,.59,.11))),tr,1.3),0.);
      tr*=exp(-2.*b*vec3(.05,.1,.045))*mix(vec3(1.),Ta,.85);
      vec3 rf=reflect(vec3(0.,0.,-1.),n);
      float F=.045+.955*pow(1.-n.z,5.);
      vec3 rl=vec3(.07,.045,.085)*(.6+.4*rf.y);
      if(n.z<.72) {
        vec2 ro=n.xy+rf.xy*((LB+n.z)/max(-rf.z,.15));
        rl=mix(world(uC+vec2(ro.x,-ro.y)*uR),rl,smoothstep(-.15,.15,rf.z));
      }
      float kd=max(dot(rf,uKey),0.);
      float k1=exp(-(1.-kd)*70.)*.75+exp(-(1.-kd)*9.)*.1,k2=sbox(rf,uStrip,vec2(.05,1.3),.04,.035);
      float rr=sqrt(r2);
      vec2 Dc=normalize(-uKey.xy);
      float cz=(rr-.7)/.17;
      float caus=exp(-cz*cz)*pow(max(dot(q/max(rr,.001),Dc),0.),5.);
      g3=tr*(1.-F)+rl*F+vec3(1.,.97,.94)*k1*1.1+vec3(1.,.8,.6)*k2*.5+vec3(1.,.8,.62)*caus*.34*(.7+.5*uCoreI);
      g3+=vec3(1.,.84,.68)*(1.-smoothstep(0.,.16,e-uD))*smoothstep(0.,.06,uD)*1.4;
    }
    col=mix(col,vec4(sh(g3+em),1.),aa*ce*uOrbA);
    col.rgb+=sh(em)*(1.-ce)*aa*uOrbA;
  }
  float gn=fract(sin(dot(gl_FragCoord.xy+floor(uT*24.)*vec2(37.,71.),vec2(12.9898,78.233)))*43758.5453);
  col.rgb+=(gn-.5)*.05*col.a;
  col.rgb=clamp(col.rgb,0.,1.);
  col.a=clamp(max(col.a,max(col.r,max(col.g,col.b))),0.,1.);
  gl_FragColor=col;
}
`;

  // Pass 2: molecules. Wind-swept on the way out, an accretion spiral on the way in,
  // and a burst of light for celebrate().
  const DUST_VS = `
attribute vec3 aDir;
attribute vec4 aRnd;
uniform vec2 uC,uCss;
uniform float uQ,uT,uD,uR,uMode,uOrbA,uForm,uBurst;
uniform mat3 uM;
varying vec4 vCol;
` + NOISE + `
void main() {
  vec3 home=uM*aDir;
  float e=ero(home);
  float u=clamp(uD-e,0.,1.);
  float s=u*u*(3.-2.*u);
  vec3 tb=vec3(sin(home.y*3.7+uT*.9+aRnd.x*6.28),cos(home.z*3.1+uT*.7+aRnd.y*6.28),sin(home.x*4.3+uT*.8+aRnd.z*6.28));
  vec3 po=home*(1.+.25*s)+WIND*(.5+2.9*aRnd.y)*s*s+tb*(.12+.5*aRnd.x)*s+vec3(0.,.5*(aRnd.z-.3),0.)*s*s;
  float ao=smoothstep(0.,.06,u)*(1.-smoothstep(.3,1.,u));
  vec3 fl=normalize(vec3(aDir.x,aDir.y*.16,aDir.z)+vec3(1e-4));
  float rad=1.4+2.3*aRnd.y*aRnd.y;
  float an=s*(2.2+1.6*aRnd.x)+uT*.12*s;
  float ca=cos(an),sa=sin(an);
  vec3 qi=mix(aDir,fl*rad,s);
  qi=vec3(ca*qi.x+sa*qi.z,qi.y,-sa*qi.x+ca*qi.z);
  vec3 pin=uM*qi;
  float ai=(1.-smoothstep(.7,1.,u))*smoothstep(0.,.05,u)*(2.-u);
  vec3 pos=mix(po,pin,uMode);
  float al=mix(ao,ai,uMode)*(.5+.5*aRnd.z);
  float sz=(1.5+3.2*aRnd.z*aRnd.z)*mix(mix(1.,.45,u),1.,uMode);
  if(aRnd.w>.97) {
    float ro=1.25+1.3*aRnd.y;
    float th=aRnd.x*6.2832+uT*.5/pow(ro,1.5);
    vec3 b1=normalize(cross(aDir,vec3(.31,.9,.13)));
    vec3 b2=cross(aDir,b1);
    pos=ro*(b1*cos(th)+b2*sin(th));
    al=(.35+.65*(.5+.5*sin(uT*1.3+aRnd.x*40.)))*.8;
    sz=1.6+2.2*aRnd.z;
  }
  // celebrate(): a few of the resting molecules fly out as a burst of light
  if(uBurst>=0.&&aRnd.w>.93&&aRnd.w<=.97) {
    float ag=uBurst-.12*fract(aRnd.x*13.7);
    float lf=1.1+.9*aRnd.z;
    float ub=clamp(ag/lf,0.,1.);
    float ou=1.-exp(-max(ag,0.)*2.4);
    float ba=aRnd.x*6.2832;
    float bd=.9+(1.1+2.1*aRnd.y)*ou;
    pos=vec3(cos(ba)*bd,sin(ba)*bd+(.15+.35*fract(aRnd.z*5.1))*ou-.22*ag*ag,0.);
    al=(1.-ub)*(1.-ub)*min(1.,max(ag,0.)/.08)*.95;
    sz=(2.+3.2*fract(aRnd.y*7.3))*(1.6-.8*ub);
  }
  float occ=mix(1.,smoothstep(.94,1.06,length(pos.xy)),step(pos.z,0.)*uForm);
  float ps=1.+pos.z*.07;
  vec2 sp=uC+vec2(pos.x,-pos.y)*uR*ps;
  float bl=abs(pos.z)*.3;
  gl_Position=vec4(sp.x/uCss.x*2.-1.,1.-sp.y/uCss.y*2.,0.,1.);
  gl_PointSize=clamp(sz*uQ*ps*(1.+bl)*(.6+.4*min(uR/74.,1.)),1.5,48.);
  float h=fract(aRnd.x*7.31);
  vec3 col=h<.34?vec3(1.,.74,.54):h<.58?vec3(1.,.9,.82):h<.8?vec3(1.,.5,.68):vec3(.74,.52,1.);
  al*=occ*uOrbA/(1.+bl*bl*1.5);
  vCol=vec4(col*al,al);
}
`;
  const DUST_FS = `
precision mediump float;
varying vec4 vCol;
void main() {
  vec2 d=gl_PointCoord*2.-1.;
  float r2=dot(d,d);
  if(r2>1.)discard;
  gl_FragColor=vCol*exp(-r2*4.);
}
`;

  const SEED_COUNT = 2600;
  const MAX_PIXELS = 8.3e6;
  const MIN_RATIO = 0.75;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const self = document.currentScript;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ss = (u) => u * u * (3 - 2 * u);
  const sm = (a, b, x) => ss(clamp((x - a) / (b - a), 0, 1));
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

  let dead = false;     // the Canvas 2D orb has taken over
  let lost = false;     // WebGL context lost, waiting for it to come back
  let lostFor = 0;
  let checked = false;  // the first whole orb of this context has been read back
  let reduced = mq.matches;
  let hidden = document.hidden;
  let raf = 0;
  let last = 0;
  let vw = 0;
  let vh = 0;
  let q = Math.min(window.devicePixelRatio || 1, 2.5); // WebGL pixel ratio, lowered if frames run slow
  let eff = q;
  let ema = 0.016;
  let slow = 0;
  let blank = false;
  let bgStill = false;
  let frameNo = 0;

  // Orb state. D is how scattered the sphere is: 0 whole, 2 gone.
  let t = 0;
  let st = 'off'; // off | swap | wait | in | hold | out | gap
  let D = 2;
  let mode = 1; // 1 molecules spiral in, 0 they blow away
  let tau = 0;
  let w = 0;
  let hold = 0;
  let beat = 0;
  let bt = 99;
  let rate = 1 / 3;
  let envA = 0;
  let envT = 0;
  let scale = 1;
  let energy = 1;
  let eA = 1;
  let band = [160, 100, 100, 200];
  let voice = false;
  let holdDur = 9.5;
  let anchor = null;
  let slot = '';
  let cx = 0;
  let cy = 0;
  let R = 74;
  let colX = 0;
  let colHalf = 1e5;
  let bg = [487.5, 801.8, 0, 0];
  let tx = 0;
  let ty = 0;
  let ptr = null;
  let tap = null;
  const pulses = [-1, -1];
  // Voice: simulated syllables of [data-say], or an outside level from level().
  let syl = null;
  let vt = 0;
  let vEnd = 0;
  let vRaw = 0;
  let vA = 0;
  let vB = 0;
  let vRing = 9;
  let said = '';
  let sayIn = -1;
  let ext = 0;
  let extAt = -1e9;
  let extRing = 9;
  // celebrate()
  let cheerAt = 0;
  let burstT = -1;
  let ring2 = -1;

  function fallback(why) {
    if (dead) return;
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (why) console.warn('NextStep orb: switching to the Canvas 2D orb.', why);
    try {
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (err) { /* already gone */ }
    // A canvas keeps the first kind of context it was given, so the 2D orb gets a fresh one.
    const fresh = document.createElement('canvas');
    fresh.id = 'orb';
    fresh.setAttribute('aria-hidden', 'true');
    stage.replaceWith(fresh);
    const here = self && self.src ? self.src : '';
    const next = here.replace(/orb\.js(?=$|\?)/, 'orb-2d.js');
    const s = document.createElement('script');
    s.src = next && next !== here ? next : 'orb-2d.js';
    document.head.appendChild(s);
  }

  let gl = null;
  try {
    // A software-only WebGL would crawl through these shaders: let it fail and use the 2D orb.
    gl = stage.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: true });
  } catch (err) {
    gl = null;
  }
  if (!gl) { fallback(); return; }

  // Molecule seeds: home positions on a Fibonacci sphere plus four random numbers each.
  const seeds = new Float32Array(SEED_COUNT * 7);
  (function () {
    let s = 20261115;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < SEED_COUNT; i++) {
      const y = 1 - (2 * (i + 0.5)) / SEED_COUNT;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996323;
      seeds.set([Math.cos(a) * r, y, Math.sin(a) * r, rnd(), rnd(), rnd(), rnd()], i * 7);
    }
  })();

  function program(vs, fs, attribs) {
    const p = gl.createProgram();
    const shaders = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].map(([type, src]) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(p, s);
      return s;
    });
    attribs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw Error([gl.getProgramInfoLog(p)].concat(shaders.map((s) => gl.getShaderInfoLog(s))).filter(Boolean).join('\n') || 'shader failed');
    }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  let glass = null;
  let dust = null;
  let quad = null;
  let cloud = null;
  function build() {
    glass = program(QUAD_VS, GLASS_FS, ['aP']);
    dust = program(DUST_VS, DUST_FS, ['aDir', 'aRnd']);
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    cloud = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cloud);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  }
  try {
    build();
  } catch (err) {
    fallback(err);
    return;
  }

  const ag = aurora.getContext('2d', { alpha: true, desynchronized: true });
  const motes = [];
  for (let i = 0; i < 48; i++) {
    motes.push({ x: Math.random() * 390, y: Math.random() * 844, z: 0.3 + Math.random() * 0.7, p: Math.random() * 6.28 });
  }

  function sizeStage() {
    eff = Math.max(MIN_RATIO, Math.min(q, Math.sqrt(MAX_PIXELS / Math.max(1, vw * vh))));
    stage.width = Math.max(1, Math.round(vw * eff));
    stage.height = Math.max(1, Math.round(vh * eff));
    stage.style.width = vw + 'px';
    stage.style.height = vh + 'px';
    blank = false;
  }

  function resize(force) {
    const nw = window.innerWidth;
    const nh = window.innerHeight;
    if (!force && nw === vw && nh === vh) return;
    vw = nw;
    vh = nh;
    const s = reduced ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    aurora.width = Math.max(1, Math.round(vw * s));
    aurora.height = Math.max(1, Math.round(vh * s));
    aurora.style.width = vw + 'px';
    aurora.style.height = vh + 'px';
    if (ag) ag.setTransform(s, 0, 0, s, 0, 0);
    bgStill = false;
    sizeStage();
  }

  function pulse() {
    if (pulses[0] < 0 || (pulses[1] >= 0 && pulses[0] > pulses[1])) pulses[0] = 0;
    else pulses[1] = 0;
    bt = 0;
  }

  function read(el) {
    const d = el.dataset;
    const up = (d.up || '160,100').split(',');
    const dn = (d.down || '100,200').split(',');
    band = [num(up[0], 160), num(up[1], 100), num(dn[0], 100), num(dn[1], 200)];
    scale = num(d.s, 1) || 1;
    envT = num(d.env, 1);
    energy = num(d.energy, 1);
    voice = d.voice === '1';
    holdDur = voice ? 1e9 : scale >= 1 ? 9.5 : 15;
  }

  // Two anchors are the same slot when a screen re-renders itself; the orb then stays as it is.
  function slotOf(el) {
    const screen = el.closest('[data-screen]');
    return (screen ? screen.dataset.screen : '') + '/' + el.className;
  }

  function sayLine() {
    const line = pick('[data-say]');
    return line ? line.textContent.trim() : '';
  }

  // The interviewer's question becomes a syllable timeline that drives the white core.
  // Skipped while an outside level (read aloud, a microphone) is already driving it.
  function say() {
    syl = null;
    vRaw = 0;
    const text = sayLine();
    said = text;
    if (!text || performance.now() - extAt < 600) return;
    const next = [];
    let time = 0.3;
    let k = 0;
    text.split(/\s+/).forEach((word) => {
      const n = Math.max(1, (word.toLowerCase().replace(/e\b/, '').match(/[aeiouy]+/g) || []).length);
      for (let i = 0; i < n; i++) {
        next.push({ t: time, amp: 0.62 + 0.38 * Math.abs(Math.sin(++k * 2.7)), first: i === 0, fired: false });
        time += 0.17;
      }
      time += /[.?!]\W*$/.test(word) ? 0.5 : /[,;:]\W*$/.test(word) ? 0.26 : 0.04;
    });
    syl = next;
    vt = 0;
    vEnd = time + 0.2;
    vRing = 9;
  }

  function stepVoice(dt) {
    vRaw = 0;
    if (!syl) return;
    vt += dt;
    vRing += dt;
    let a = 0;
    for (const s of syl) {
      const x = vt - s.t;
      if (x <= 0 || x > 0.5) continue;
      a = Math.max(a, s.amp * Math.min(1, x / 0.03) * Math.exp(-Math.max(0, x - 0.03) / 0.085));
      if (s.first && !s.fired) {
        s.fired = true;
        if (vRing > 1.2) { vRing = 0; pulse(); }
      }
    }
    vRaw = a;
    if (vt > vEnd) syl = null;
  }

  /* Outside voice level (0..1): a quick rise, a soft fall, a ring on a strong onset. */
  function level(v) {
    if (dead || reduced || hidden) return;
    const x = clamp(Number(v) || 0, 0, 1);
    if (x - ext > 0.35 && extRing > 1.2 && st === 'hold') { extRing = 0; pulse(); }
    ext = Math.max(ext, x);
    extAt = performance.now();
    syl = null;
  }

  function celebrate() {
    if (dead || reduced || hidden) return;
    cheerAt = performance.now();
    schedule();
  }

  function stepCheer(dt) {
    if (cheerAt) {
      if (anchor && anchor.isConnected && st === 'hold') {
        cheerAt = 0;
        burstT = 0;
        ring2 = 0.32;
        pulse();
      } else if (performance.now() - cheerAt > 7000) cheerAt = 0;
    }
    if (ring2 >= 0 && (ring2 -= dt) < 0) { ring2 = -1; pulse(); }
    if (burstT >= 0 && (burstT += dt) > 2.3) burstT = -1;
  }

  function measure() {
    if (!anchor || !anchor.isConnected) return;
    const r = anchor.getBoundingClientRect();
    if (r.width < 2) return;
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    R = Math.max(8, r.width / 2);
    const col = anchor.closest('[data-screen]');
    const c = col ? col.getBoundingClientRect() : { left: 0, width: vw };
    colX = c.left + c.width / 2;
    colHalf = c.width / 2;
    const b = document.body.getBoundingClientRect();
    bg = [1.25 * Math.max(1, b.width), 0.95 * Math.max(1, b.height), -b.left, -b.top];
  }

  function step(dt, raw) {
    t += dt;
    bt += dt;
    for (let i = 0; i < 2; i++) {
      if (pulses[i] >= 0 && (pulses[i] += dt) > 2.4) pulses[i] = -1;
    }

    const el = pick('[data-orb]');
    if (el !== anchor && st !== 'swap') {
      if (el && anchor && st !== 'off' && slotOf(el) === slot) {
        // The screen re-rendered itself in place: the orb stays whole. A new question is spoken.
        anchor = el;
        read(el);
        if (voice && st === 'hold' && sayLine() !== said) sayIn = 0.35;
      } else {
        st = 'swap';
        envT = 0;
        if (D < 0.001) mode = 1;
        syl = null;
        vRaw = 0;
        sayIn = -1;
      }
    }
    if (st === 'swap') {
      D = Math.min(2, D + dt * 4);
      if (D >= 2 && envA < 0.04) {
        anchor = el;
        mode = 1;
        if (el) { slot = slotOf(el); read(el); st = 'wait'; w = 0; }
        else { slot = ''; st = 'off'; }
      }
    } else if (st === 'wait') {
      if ((w += dt) > 0.15) { st = 'in'; tau = 0; mode = 1; }
    } else if (st === 'in') {
      tau = Math.min(1, tau + dt / 2.6);
      D = 2 * (1 - ss(tau));
      if (tau >= 1) {
        D = 0;
        st = 'hold';
        hold = 0;
        beat = 0;
        if (voice) say();
        else pulse();
      }
    } else if (st === 'hold') {
      hold += dt;
      if (sayIn >= 0 && (sayIn -= dt) < 0) { sayIn = -1; say(); }
      if (voice) stepVoice(dt);
      else if ((beat += dt) > 4.6) { beat = 0; pulse(); }
      if (hold > holdDur) { st = 'out'; tau = 0; mode = 0; rate = 1 / 3; }
    } else if (st === 'out') {
      tau = Math.min(1, tau + dt * rate);
      D = 2 * ss(tau);
      if (tau >= 1) { st = 'gap'; w = 0; }
    } else if (st === 'gap') {
      if ((w += dt) > 0.45) { st = 'in'; tau = 0; mode = 1; }
    }

    envA += (envT - envA) * (1 - Math.exp(-dt * 7));
    eA += (energy - eA) * (1 - Math.exp(-dt * 3));
    extRing += dt;
    ext *= Math.exp(-dt / 0.14);
    const extOn = performance.now() - extAt < 500;
    const speaking = st === 'hold' && voice && syl;
    vA += ((extOn ? ext : speaking ? vRaw : 0) - vA) * (1 - Math.exp(-dt * 22));
    vB += ((extOn || speaking ? 1 : 0) - vB) * (1 - Math.exp(-dt * 4));
    stepCheer(dt);

    measure();

    let ttx = 0;
    let tty = 0;
    if (ptr && anchor && performance.now() - ptr.t < 3500) {
      const dx = ptr.x - cx;
      const dy = ptr.y - cy;
      if (Math.hypot(dx, dy) < 520) {
        ttx = clamp(dx / (R * 3), -1, 1);
        tty = clamp(dy / (R * 3), -1, 1);
      }
    }
    const kt = 1 - Math.exp(-dt * 4);
    tx += (ttx - tx) * kt;
    ty += (tty - ty) * kt;

    if (tap) {
      if (anchor && st === 'hold') {
        const dd = Math.hypot(tap.x - cx, tap.y - cy);
        if (voice) {
          if (dd < R * 1.8) say();
        } else if (dd < R * 1.15) {
          st = 'out';
          tau = 0;
          mode = 0;
          rate = 1 / 1.9;
        } else if (dd < R * 3.4) {
          beat = 0;
          pulse();
        }
      }
      tap = null;
    }

    // Drop the WebGL resolution a notch when the phone cannot hold about 33 frames a second.
    if (raw < 0.25) ema = ema * 0.95 + raw * 0.05;
    slow = ema > 0.03 ? slow + 1 : 0;
    if (slow > 90 && q > MIN_RATIO) {
      q = Math.max(MIN_RATIO, q * 0.75);
      slow = 0;
      sizeStage();
    }
  }

  // Reduced motion: no loop. Each still frame shows the orb whole on its anchor.
  function settle() {
    const el = pick('[data-orb]');
    if (el !== anchor) {
      anchor = el;
      slot = el ? slotOf(el) : '';
    }
    if (el) read(el);
    st = el ? 'hold' : 'off';
    D = el ? 0 : 2;
    mode = 1;
    envA = el ? envT : 0;
    eA = energy;
    t = 3.2;
    hold = 0;
    beat = 0;
    bt = 99;
    pulses[0] = pulses[1] = -1;
    tx = ty = 0;
    tap = null;
    vA = vB = vRaw = 0;
    syl = null;
    sayIn = -1;
    ext = 0;
    cheerAt = 0;
    burstT = -1;
    ring2 = -1;
    measure();
  }

  function drawAurora(still, dt) {
    if (!ag || (still && bgStill)) return;
    const sx = vw / 390;
    const sy = vh / 844;
    ag.clearRect(0, 0, vw, vh);
    ag.save();
    ag.scale(sx, sy);
    const lx = -30 + (still ? 0 : Math.sin(t / 6.5) * 30);
    const ly = -40 + (still ? 0 : Math.cos(t / 8.3) * 26);
    const br = still ? 1 : 0.88 + 0.12 * Math.sin(t / 4.1);
    const glow = ag.createRadialGradient(lx, ly, 0, lx, ly, 580);
    glow.addColorStop(0, 'rgba(206,150,196,' + (0.34 * br).toFixed(4) + ')');
    glow.addColorStop(0.4, 'rgba(150,90,150,' + (0.13 * br).toFixed(4) + ')');
    glow.addColorStop(1, 'rgba(150,90,150,0)');
    ag.fillStyle = glow;
    ag.fillRect(0, 0, 390, 844);
    if (still) {
      ag.restore();
      bgStill = true;
      return;
    }
    bgStill = false;
    const sw = (t / 15) % 1;
    const pos = -260 + sw * 1300;
    const pk = 0.055 * Math.sin(Math.PI * sw);
    ag.rotate(Math.PI / 4);
    const sheen = ag.createLinearGradient(pos - 150, 0, pos + 150, 0);
    sheen.addColorStop(0, 'rgba(255,225,235,0)');
    sheen.addColorStop(0.5, 'rgba(255,225,235,' + pk.toFixed(4) + ')');
    sheen.addColorStop(1, 'rgba(255,225,235,0)');
    ag.fillStyle = sheen;
    ag.fillRect(pos - 150, -900, 300, 1800);
    ag.restore();
    const ms = Math.min(1.4, Math.sqrt(sx * sy));
    for (const m of motes) {
      m.x += (3 + 8 * m.z) * dt;
      m.y += (5 + 11 * m.z) * dt;
      if (m.x > 400) m.x = -10;
      if (m.y > 854) { m.y = -10; m.x = Math.random() * 390; }
      const fall = Math.max(0, 1 - Math.hypot(m.x, m.y) / 760);
      const al = fall * fall * (0.3 + 0.5 * m.z) * (0.55 + 0.45 * Math.sin(t * 0.7 + m.p));
      if (al < 0.01) continue;
      ag.fillStyle = 'rgba(255,232,224,' + al.toFixed(3) + ')';
      ag.beginPath();
      ag.arc(m.x * sx, m.y * sy, (0.5 + 1.2 * m.z) * ms, 0, 6.2832);
      ag.fill();
    }
  }

  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; };
  const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; };
  const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, -s, c, 0, 0, 0, 1]; };
  const mul = (a, b) => {
    const o = [];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) o[j * 3 + i] = a[i] * b[j * 3] + a[3 + i] * b[j * 3 + 1] + a[6 + i] * b[j * 3 + 2];
    }
    return o;
  };
  const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  function put(prog, name, v) {
    const loc = prog.u[name];
    if (!loc) return;
    if (v.length === 9) gl.uniformMatrix3fv(loc, false, v);
    else if (v.length === 4) gl.uniform4fv(loc, v);
    else if (v.length === 3) gl.uniform3fv(loc, v);
    else if (v.length === 2) gl.uniform2fv(loc, v);
    else gl.uniform1fv(loc, v);
  }

  // One readback per context, on the first frame that shows a whole orb: some drivers compile the
  // shaders and then draw nothing. (A context lost meanwhile reads zeros: not judged, checked again.)
  function drew(ox, oy) {
    checked = true;
    const px = new Uint8Array(4);
    gl.readPixels(Math.round(ox * eff), Math.round((vh - oy) * eff), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (gl.isContextLost()) {
      checked = false;
      return true;
    }
    return px[3] >= 32 && px[0] + px[1] + px[2] >= 24;
  }

  function drawOrb(still) {
    if (lost) return;
    const W = stage.width;
    const H = stage.height;
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    if (st === 'off' && envA < 0.004) {
      if (!blank) { gl.clear(gl.COLOR_BUFFER_BIT); blank = true; }
      return;
    }
    blank = false;
    gl.clear(gl.COLOR_BUFFER_BIT);

    const k = Math.min(1, R / 74);
    const ox = cx + (still ? 0 : Math.sin(t * 0.37 + 1.3) * 2.5 * k) + tx * R * 0.06;
    const oy = cy + (still ? 0 : Math.sin(t * 0.55) * 4.5 * k) + ty * R * 0.06;
    const reach = (burstT >= 0 ? 5.2 : 3.9) * R;
    const top = Math.max(0, Math.min(oy - band[0], oy - reach));
    const bottom = Math.min(vh, Math.max(oy + band[3], oy + reach));
    const left = Math.max(0, Math.min(colX - colHalf - 160, ox - reach));
    const right = Math.min(vw, Math.max(colX + colHalf + 160, ox + reach));
    if (bottom <= top || right <= left) return;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.floor(left * eff), Math.floor((vh - bottom) * eff), Math.ceil((right - left) * eff), Math.ceil((bottom - top) * eff));

    const beatAmt = bt < 4 ? Math.min(1, bt / 0.14) * Math.exp(-bt * 2.4) : 0;
    const ign = 1 - sm(0.9, 1.6, D);
    const orbA = anchor ? 1 : 0;
    const coreI = (0.62 + 0.38 * eA) * (1 + 0.3 * beatAmt) * ign;
    const coreR = (0.2 + 0.1 * eA) * (1 + 0.1 * beatAmt);
    const voiceAmt = Math.min(1, vA * 0.88 + vB * 0.12) * ign;

    gl.useProgram(glass.p);
    gl.disable(gl.BLEND);
    put(glass, 'uRes', [W, H]);
    put(glass, 'uQ', [eff]);
    put(glass, 'uT', [t]);
    put(glass, 'uR', [R]);
    put(glass, 'uD', [D]);
    put(glass, 'uEnv', [envA]);
    put(glass, 'uS', [scale]);
    put(glass, 'uCoreI', [coreI]);
    put(glass, 'uCoreR', [coreR]);
    put(glass, 'uOrbA', [orbA]);
    put(glass, 'uFrame', [frameNo++ % 64]);
    put(glass, 'uVoice', [voiceAmt]);
    put(glass, 'uC', [ox, oy]);
    put(glass, 'uPulse', pulses);
    put(glass, 'uTilt', [tx, ty]);
    put(glass, 'uBand', [oy - band[0], oy - band[1], oy + band[2], oy + band[3]]);
    put(glass, 'uBgS', [bg[0], bg[1]]);
    put(glass, 'uBgO', [bg[2], bg[3]]);
    put(glass, 'uCol', [colX, colHalf]);
    put(glass, 'uKey', unit([-0.58 + tx * 0.12, 0.62 - ty * 0.12, 0.53]));
    put(glass, 'uStrip', unit([0.86, -0.2, -0.42]));
    put(glass, 'uRot', mul(rotX(0.35 + ty * 0.35), rotY(t * 0.22 + tx * 0.35)));
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!orbA) return;

    gl.useProgram(dust.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    put(dust, 'uC', [ox, oy]);
    put(dust, 'uCss', [vw, vh]);
    put(dust, 'uQ', [eff]);
    put(dust, 'uT', [t]);
    put(dust, 'uD', [D]);
    put(dust, 'uR', [R]);
    put(dust, 'uMode', [mode]);
    put(dust, 'uOrbA', [orbA]);
    put(dust, 'uForm', [1 - sm(0.1, 0.9, D)]);
    put(dust, 'uBurst', [still ? -1 : burstT]);
    put(dust, 'uM', mul(rotZ(0.4), rotX(0.5)));
    gl.bindBuffer(gl.ARRAY_BUFFER, cloud);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.drawArrays(gl.POINTS, 0, SEED_COUNT);

    if (!checked && st === 'hold' && D === 0 && ox > 2 && oy > 2 && ox < vw - 2 && oy < vh - 2 && !drew(ox, oy)) {
      fallback('WebGL drew an empty orb');
    }
  }

  function frame(now) {
    raf = 0;
    if (dead || hidden) return;
    const raw = (now - last) / 1000;
    const dt = clamp(raw, 0, 0.05);
    last = now;
    if (reduced) {
      settle();
      drawAurora(true, 0);
      drawOrb(true);
      return;
    }
    // A lost context gets a few seconds on screen to come back before the 2D orb takes over.
    if (lost && (lostFor += dt) > 3) {
      fallback('the WebGL context did not come back');
      return;
    }
    step(dt, raw);
    drawAurora(false, dt);
    drawOrb(false);
    if (!dead) raf = requestAnimationFrame(frame);
  }

  function schedule() {
    if (raf || hidden || dead) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  const still = () => { if (reduced) schedule(); };

  // Diagnostics for QA (read-only).
  function info() {
    return { renderer: 'webgl', state: st, ratio: eff, lost, voice: clamp(vA * 0.88 + vB * 0.12, 0, 1), burst: burstT >= 0 };
  }

  stage.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; lostFor = 0; });
  stage.addEventListener('webglcontextrestored', () => {
    if (dead) return;
    try {
      build();
      lost = false;
      lostFor = 0;
      checked = false;
      blank = false;
      schedule();
    } catch (err) {
      fallback(err);
    }
  });
  window.addEventListener('pointermove', (e) => { ptr = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    ptr = { x: e.clientX, y: e.clientY, t: performance.now() };
    tap = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  const onResize = () => { if (dead) return; resize(false); schedule(); };
  window.addEventListener('resize', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else schedule();
  });
  const onMotion = () => {
    if (dead) return;
    reduced = mq.matches;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    resize(true);
    schedule();
  };
  if (mq.addEventListener) mq.addEventListener('change', onMotion);
  else if (mq.addListener) mq.addListener(onMotion);

  // With reduced motion there is no loop, so redraw the still frame whenever the layout can move.
  window.addEventListener('scroll', still, { passive: true, capture: true });
  document.addEventListener('toggle', still, true);
  if (appRoot && window.MutationObserver) new MutationObserver(still).observe(appRoot, { childList: true, subtree: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(still);

  window.NextStepOrb = { celebrate, level, info };
  resize(true);
  schedule();
})();
