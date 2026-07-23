const root=document.documentElement;
const header=document.querySelector('.site-header'),menu=document.querySelector('.menu'),nav=document.querySelector('#nav');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const headerAlwaysScrolled=header?.classList.contains('scrolled')||false;
root.classList.add('motion-ready','scroll-enhanced');

const scrollGuide=document.createElement('div');
scrollGuide.className='scroll-guide';
scrollGuide.innerHTML='<span class="scroll-pill"></span>';
document.body.append(scrollGuide);
const scrollPill=scrollGuide.firstElementChild;
scrollPill.setAttribute('role','scrollbar');
scrollPill.setAttribute('aria-label','Page scroll position');
scrollPill.setAttribute('aria-orientation','vertical');
scrollPill.setAttribute('aria-valuemin','0');
scrollPill.setAttribute('aria-valuemax','100');
scrollPill.setAttribute('aria-valuenow','0');
root.id||='page-scroll-root';
scrollPill.setAttribute('aria-controls',root.id);
scrollPill.tabIndex=0;

document.querySelectorAll('.values article,.practice-card,.people article,.insight-grid article').forEach((el,index)=>{
  const group=el.parentElement;
  const siblings=[...group.children].filter(child=>child.classList.contains('reveal'));
  el.style.setProperty('--reveal-delay',`${Math.min(siblings.indexOf(el)*90,270)}ms`);
});
document.querySelectorAll('.intro-copy,.philosophy-copy,.consultation').forEach(el=>el.dataset.reveal='right');
document.querySelectorAll('.hero-image,.quote,.contact-copy').forEach(el=>el.dataset.reveal='left');

const revealItems=[...document.querySelectorAll('.reveal')];
if(reduceMotion||!('IntersectionObserver' in window)){
  revealItems.forEach(el=>el.classList.add('visible'));
}else{
  const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target)}
  }),{threshold:.14,rootMargin:'0px 0px -5%'});
  revealItems.forEach(el=>revealObserver.observe(el));
}

let scrollFrame=0;
let dragging=false;
let dragStartY=0;
let dragStartScroll=0;
const scrollMetrics=()=>{
  const range=Math.max(root.scrollHeight-innerHeight,0);
  const travel=Math.max(scrollGuide.clientHeight-scrollPill.offsetHeight,0);
  return{range,travel};
};
const syncScroll=()=>{
  scrollFrame=0;
  const top=window.scrollY;
  const{range,travel}=scrollMetrics();
  const progress=range?Math.min(Math.max(top/range,0),1):0;
  scrollPill.style.transform=`translate3d(0,${travel*progress}px,0)`;
  scrollPill.setAttribute('aria-valuenow',String(Math.round(progress*100)));
  scrollGuide.classList.toggle('active',range>0);
  scrollGuide.classList.toggle('is-hidden',range<1);
  header?.classList.toggle('scrolled',headerAlwaysScrolled||top>30);
  if(!reduceMotion&&innerWidth>850){
    root.style.setProperty('--hero-parallax',`${Math.min(top*.035,22)}px`);
  }
};
const requestScrollSync=()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(syncScroll)};
addEventListener('scroll',requestScrollSync,{passive:true});
addEventListener('resize',requestScrollSync,{passive:true});
syncScroll();

const scrollToValue=value=>{
  const{range}=scrollMetrics();
  scrollTo({top:Math.min(range,Math.max(0,value)),behavior:'auto'});
};
scrollPill.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  dragging=true;
  dragStartY=event.clientY;
  dragStartScroll=scrollY;
  scrollPill.setPointerCapture(event.pointerId);
  scrollPill.classList.add('is-dragging');
  event.preventDefault();
});
scrollPill.addEventListener('pointermove',event=>{
  if(!dragging)return;
  const{range,travel}=scrollMetrics();
  scrollToValue(dragStartScroll+((event.clientY-dragStartY)/Math.max(1,travel))*range);
});
const endDrag=event=>{
  if(!dragging)return;
  dragging=false;
  scrollPill.classList.remove('is-dragging');
  if(scrollPill.hasPointerCapture(event.pointerId))scrollPill.releasePointerCapture(event.pointerId);
};
scrollPill.addEventListener('pointerup',endDrag);
scrollPill.addEventListener('pointercancel',endDrag);
scrollPill.addEventListener('keydown',event=>{
  const pageStep=innerHeight*.82;
  const steps={ArrowUp:-72,ArrowDown:72,PageUp:-pageStep,PageDown:pageStep,Home:-Infinity,End:Infinity};
  if(!(event.key in steps))return;
  event.preventDefault();
  const{range}=scrollMetrics();
  const step=steps[event.key];
  const target=step===Infinity?range:step===-Infinity?0:scrollY+step;
  scrollTo({top:target,behavior:reduceMotion?'auto':'smooth'});
});

menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav?.classList.toggle('open',!open)});
nav?.addEventListener('click',e=>{if(e.target.matches('a')){nav.classList.remove('open');menu?.setAttribute('aria-expanded','false')}});

const form=document.querySelector('.consultation');form?.addEventListener('submit',e=>{e.preventDefault();const status=form.querySelector('.form-status');if(!form.checkValidity()){form.reportValidity();status.textContent='Please complete the required fields.';return}status.textContent='Thank you. Your consultation request is ready for the KDH team.';form.reset()});
const cookie=document.querySelector('.cookie');if(cookie){if(!localStorage.getItem('kdh-cookie-choice'))cookie.hidden=false;cookie.addEventListener('click',e=>{const choice=e.target.dataset.cookie;if(choice){localStorage.setItem('kdh-cookie-choice',choice);cookie.hidden=true}})}
