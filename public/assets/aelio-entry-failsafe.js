'use strict';
(function(){
  const overlay=document.getElementById('aelio-entry');
  if(!overlay)return;
  let timer=null,closed=false;
  function close(){
    if(closed)return;
    closed=true;
    if(timer!==null)clearTimeout(timer);
    try{sessionStorage.setItem('aelio-intro-v5','1')}catch(_){}
    overlay.classList.add('is-exiting');
    overlay.style.pointerEvents='none';
    window.setTimeout(()=>overlay.remove(),550);
  }
  const skip=overlay.querySelector('.aelio-entry-skip');
  if(skip)skip.addEventListener('click',close);
  let seen=false;
  try{seen=sessionStorage.getItem('aelio-intro-v5')==='1'}catch(_){}
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(seen||reduce){overlay.remove();return}
  timer=window.setTimeout(close,4000);
  // Backup for browsers where normal scheduling is interrupted.
  window.addEventListener('pageshow',function(){if(!closed&&performance.now()>6000)close()},{once:true});
})();
