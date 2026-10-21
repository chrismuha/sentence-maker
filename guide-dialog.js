const launch=document.querySelector('.mcr-guide-launch');
const dialog=document.querySelector('.mcr-guide');
if(launch&&dialog){
 const content=dialog.querySelector('.mcr-guide-content'), topics=[...dialog.querySelectorAll('.mcr-guide-topic')], select=dialog.querySelector('select'), pagination=dialog.querySelector('.mcr-guide-footer'), toggle=dialog.querySelector('input'), previous=dialog.querySelector('[data-guide-previous]'), next=dialog.querySelector('[data-guide-next]'), status=dialog.querySelector('[role="status"]');
 let page=0;
 function show(value){page=Math.max(0,Math.min(topics.length-1,Number(value)));topics.forEach((topic,index)=>topic.hidden=toggle.checked&&index!==page);pagination.hidden=!toggle.checked;select.value=String(page);previous.disabled=page===0;next.disabled=page===topics.length-1;status.textContent=`Page ${page+1} of ${topics.length}`;content.scrollTop=0;}
 launch.addEventListener('click',()=>{show(0);dialog.showModal();dialog.querySelector('.mcr-guide-close').focus();});
 dialog.querySelector('.mcr-guide-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
 toggle.addEventListener('change',()=>show(0));select.addEventListener('change',()=>{toggle.checked=true;show(select.value);});previous.addEventListener('click',()=>show(page-1));next.addEventListener('click',()=>show(page+1));show(0);
}
