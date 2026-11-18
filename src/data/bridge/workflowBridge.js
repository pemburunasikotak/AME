/* ARUS v96 workflow-only presentation. Native calculation engines are untouched. */
(() => {
 'use strict';
 const init=()=>{
  const module=document.documentElement.dataset.arusModule;
  if(!['resistance','selection','interaction','interaction-grouped'].includes(module))return;
  const $=sel=>document.querySelector(sel);
  const stepper=(container)=>{
    const nav=document.createElement('div');nav.className='arus-workflow-steps';nav.setAttribute('aria-label','Calculation workflow');
    for(const [id,label] of [['method','Select method'],['input','Enter inputs'],['result','Results']]){
      const node=document.createElement('span');node.dataset.stage=id;node.textContent=label;nav.append(node);
    }
    container.prepend(nav);
    return state=>{nav.dataset.active=state;for(const item of nav.children){item.classList.toggle('is-active',item.dataset.stage===state);item.classList.toggle('is-complete',['method','input','result'].indexOf(item.dataset.stage)<['method','input','result'].indexOf(state));}};
  };
  const goto=(target)=>requestAnimationFrame(()=>target?.scrollIntoView({block:'start',behavior:'smooth'}));
  const button=(text,cls='arus-flow-action')=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;return b;};
  const note=(text)=>{const p=document.createElement('p');p.className='arus-flow-hint';p.textContent=text;return p;};
  if(module==='resistance'){
    const view=$('#view-calculator'),first=view?.querySelector(':scope > .panel'),picker=$('.arus-hull-method-picker');
    const inputs=$('#vesselFields'),actions=first?.querySelector('.actions'),results=$('#resultPanel'),run=$('#calculate'),method=$('#method');
    if(!first||!picker||!inputs||!actions||!results||!run)return;
    document.body.classList.add('arus-flow-enabled','arus-flow-resistance');
    const setStep=stepper(first);
    const caption=note('Choose the hull resistance method first. Vessel parameters will appear after selection.');
    picker.before(caption);
    const change=button('Change method','arus-flow-action arus-flow-secondary');
    change.id='arus-flow-change-resistance';actions.prepend(change);
    let chosen=false;
    const render=()=>{
      document.body.classList.toggle('arus-flow-chosen',chosen);
      caption.hidden=chosen;
      if(!chosen){
        const title=$('.arus-hull-current-name');
        if(title)title.textContent='Choose a resistance method';
        picker.querySelectorAll('.arus-hull-card').forEach(card=>{
          card.setAttribute('aria-pressed','false');
          card.querySelector('.arus-hull-selected-glyph')?.remove();
        });
      }
      const ready=chosen&&!results.classList.contains('hidden');
      results.classList.toggle('arus-flow-visible-result',ready);
      setStep(ready?'result':chosen?'input':'method');
    };
    picker.addEventListener('click',e=>{
      if(e.target.closest('.arus-hull-card')){
        chosen=true;results.classList.remove('arus-flow-visible-result');
        setTimeout(()=>{render();goto(inputs)},0);
      }
      if(e.target.closest('.arus-hull-toggle')&&chosen){
        chosen=false;results.classList.remove('arus-flow-visible-result');setTimeout(render,0);
      }
    });
    change.addEventListener('click',()=>{
      chosen=false;results.classList.add('hidden');results.classList.remove('arus-flow-visible-result');
      const toggle=$('.arus-hull-toggle');if(toggle&&$('.arus-hull-catalog')?.classList.contains('arus-hull-hidden'))toggle.click();
      render();goto(picker);
    });
    method.addEventListener('change',()=>{results.classList.remove('arus-flow-visible-result');render();});
    first.addEventListener('input',e=>{if(e.target.closest('#vesselFields')){results.classList.remove('arus-flow-visible-result');setStep('input');}},true);
    run.addEventListener('click',()=>setTimeout(()=>{
      if(!results.classList.contains('hidden')){results.classList.add('arus-flow-visible-result');setStep('result');goto(results);}
    },60));
    render();
    return;
  }
  if(module==='selection'){
    const methodBar=$('#methodBar');
    const btnKT=$('#method-kt'),btnKQ=$('#method-kq');
    if(!methodBar||!btnKT||!btnKQ)return;
    document.body.classList.add('arus-flow-enabled','arus-flow-selection');
    const setStep=stepper(methodBar);
    const intro=document.createElement('div');intro.className='arus-flow-selection-intro';intro.innerHTML='<strong>Choose the propeller selection method</strong><p>Input parameters will be shown after choosing KT Ship or KQ Power.</p>';
    methodBar.append(intro);
    const stages={kt:'method',kq:'method'};
    let chosen=null;
    const update=()=>{
      document.body.dataset.arusFlowStage=chosen?(stages[chosen]||'input'):'method';
      document.body.dataset.arusFlowMethod=chosen||'';
      setStep(chosen?(stages[chosen]||'input'):'method');
      intro.hidden=!!chosen;
      if(!chosen){
        for(const control of [btnKT,btnKQ]){
          control.classList.remove('active');control.setAttribute('aria-pressed','false');
        }
      }
    };
    for(const which of ['kt','kq']){
      const root=$('#'+which+'-mode'),form=$('#'+which+'-inputForm'),main=root?.querySelector('main.main'),aside=root?.querySelector('aside.sidebar');
      if(!root||!form||!main||!aside)continue;
      const change=button('Change method','arus-flow-action arus-flow-secondary');
      change.id='arus-flow-change-'+which;
      aside.insertBefore(change,aside.querySelector('.sidebar-head'));
      change.addEventListener('click',()=>{chosen=null;update();goto(methodBar);});
      const resetResult=()=>{stages[which]='input';if(chosen===which)update();};
      form.addEventListener('input',resetResult,true);
      form.addEventListener('change',resetResult,true);
      form.addEventListener('submit',()=>{
        stages[which]='input';update();
        // Solver yields via requestAnimationFrame + setTimeout; reveal only after Run.
        setTimeout(()=>{
          const err=$('#'+which+'-error');
          if(!err?.classList.contains('visible')&&chosen===which){stages[which]='result';update();goto(main);}
          else if(chosen===which){
            const status=aside.querySelector('.arus-flow-run-error')||note('Review the input values and run the calculation again.');
            status.classList.add('arus-flow-run-error');aside.append(status);
          }
        },450);
      });
      root.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
        // A series change can trigger native computation; only explicit Run reveals outputs.
        resetResult();
      }));
      root.querySelectorAll('button.reset').forEach(reset=>reset.addEventListener('click',resetResult));
    }
    for(const [which,control] of [['kt',btnKT],['kq',btnKQ]])control.addEventListener('click',()=>{
      chosen=which;stages[which]='input';update();goto($('#'+which+'-mode aside.sidebar'));
    });
    // Source initializes KT automatically; do not expose it as an intentional user choice.
    update();
    return;
  }
  if(module==='interaction'){
    const sheet=$('main .sheet'),sections=[...sheet?.querySelectorAll(':scope > section.block')||[]];
    if(sections.length<3)return;
    const [methodBox,inputBox,resultBox]=sections;
    document.body.classList.add('arus-flow-enabled','arus-flow-interaction');
    const setStep=stepper(sheet);
    const next=button('Continue to inputs');next.id='arus-flow-next-interaction';
    const actions=document.createElement('div');actions.className='arus-flow-bottom-actions';actions.append(next);
    methodBox.append(actions);
    const run=button('Run calculation');run.id='arus-flow-run-interaction';
    const runWrap=document.createElement('div');runWrap.className='arus-flow-bottom-actions';runWrap.append(run);
    inputBox.append(runWrap);
    const change=button('Change method','arus-flow-action arus-flow-secondary');change.id='arus-flow-change-interaction';inputBox.querySelector('.blockhead')?.append(change);
    const inputsLabel=$('#inputNote');if(inputsLabel)inputsLabel.textContent='Review the inputs, then press Run calculation to display the results.';
    let stage='method';
    const render=()=>{
      inputBox.hidden=stage==='method';resultBox.hidden=stage!=='result';
      setStep(stage);
      next.textContent=stage==='method'?'Continue to inputs':'Edit inputs';
    };
    const selectGroup=()=>{stage='input';render();goto(inputBox);};
    next.addEventListener('click',selectGroup);
    // Group selection is a deliberate method selection, including the method cards.
    $('#groupSelect')?.addEventListener('change',selectGroup);
    $('#typeSelect')?.addEventListener('change',()=>{stage='method';render();});
    inputBox.addEventListener('input',()=>{if(stage==='result'){stage='input';render();}},true);
    change.addEventListener('click',()=>{stage='method';render();goto(methodBox);});
    run.addEventListener('click',()=>{stage='result';render();goto(resultBox);});
    $('#clearInput')?.addEventListener('click',()=>{stage='input';render();});
    render();
    return;
  }
  if(module==='interaction-grouped'){
    const holder=$('main .panel')||$('main .container');
    const sections=[...holder?.querySelectorAll(':scope > section.section')||[]];
    if(sections.length<4)return;
    const [category,methodBox,inputBox,resultBox]=sections;
    document.body.classList.add('arus-flow-enabled','arus-flow-grouped');
    const setStep=stepper(holder);
    const next=button('Continue to inputs');next.id='arus-flow-next-grouped';
    const nextRow=document.createElement('div');nextRow.className='arus-flow-bottom-actions';nextRow.append(next);methodBox.append(nextRow);
    const run=button('Run calculation');run.id='arus-flow-run-grouped';
    const runRow=document.createElement('div');runRow.className='arus-flow-bottom-actions';runRow.append(run);inputBox.append(runRow);
    const change=button('Change method','arus-flow-action arus-flow-secondary');change.id='arus-flow-change-grouped';inputBox.querySelector('.parameterhead')?.append(change);
    let stage='method';
    const render=()=>{inputBox.hidden=stage==='method';resultBox.hidden=stage!=='result';setStep(stage);};
    next.addEventListener('click',()=>{stage='input';render();goto(inputBox);});
    $('#inputGroup')?.addEventListener('change',()=>{stage='input';render();goto(inputBox);});
    [$('#wakeBtn'),$('#thrustBtn')].filter(Boolean).forEach(b=>b.addEventListener('click',()=>{stage='method';render();}));
    inputBox.addEventListener('input',()=>{stage='input';render();},true);
    [$('#exampleBtn'),$('#clearGroupBtn'),$('#resetBtn')].filter(Boolean).forEach(b=>b.addEventListener('click',()=>{stage='input';render();}));
    run.addEventListener('click',()=>{stage='result';render();goto(resultBox);});
    change.addEventListener('click',()=>{stage='method';render();goto(methodBox);});
    render();
  }
 };
 window.addEventListener('DOMContentLoaded',init);
})();


/* ARUS v97 — presentation-only unified method/input/results and advanced settings. */
(() => {
 'use strict';
 const init = () => {
  const module = document.documentElement.dataset.arusModule;
  const $ = s => document.querySelector(s);
  const make = (tag, cls, txt) => { const e=document.createElement(tag); if(cls)e.className=cls; if(txt)e.textContent=txt; return e; };
  const createAdvanced = (parent,before=null) => {
    const root=make('details','arus-unified-advanced');root.id='arus-unified-advanced';
    const title=make('summary','arus-unified-summary','Advanced Settings');root.append(title);
    const content=make('div','arus-unified-advanced-body');root.append(content);
    if(before)parent.insertBefore(root,before);else parent.append(root);
    return {root,content};
  };
  const section=(container,title,node)=>{
    if(!node)return;
    const wrap=make('div','arus-unified-section');
    wrap.append(make('h3','arus-unified-group-title',title),node);
    container.append(wrap);
  };
  const harmonizeLabels=()=>{
    document.querySelectorAll('.arus-workflow-steps [data-stage="method"]').forEach(e=>e.textContent='1. Choose method');
    document.querySelectorAll('.arus-workflow-steps [data-stage="input"]').forEach(e=>e.textContent='2. Enter inputs');
    document.querySelectorAll('.arus-workflow-steps [data-stage="result"]').forEach(e=>e.textContent='3. Results');
  };
  harmonizeLabels();
  if(module==='resistance'){
    const container=$('#vesselFields'),method=$('#method'),first=$('#view-calculator > .panel');
    if(!container||!method||!first)return;
    const actions=first.querySelector(':scope > .actions');
    const {root,content}=createAdvanced(first,actions);
    let stored=[];
    const restore=()=>{
      // Before the source engine changes methods, return fields to their original
      // DOM positions. Their native change listeners depend on the original IDs.
      for(const {node,mark,open} of stored){
        if(mark.parentNode)mark.replaceWith(node);
        if(node.tagName==='DETAILS')node.open=open;
        node.classList.remove('arus-unified-inner');
        node.querySelector(':scope > summary')?.classList.remove('arus-unified-hide-summary');
      }
      stored=[];content.replaceChildren();
    };
    const move=(name,node)=>{
      if(!node||stored.some(item=>item.node===node))return;
      const mark=document.createComment('arus-advanced-field-location');
      node.before(mark);
      stored.push({node,mark,open:node.tagName==='DETAILS'?node.open:false});
      if(node.tagName==='DETAILS'){
        if(['arus-advanced-ship','arus-harvald-settings','arus-advanced-method'].includes(node.id)){
          node.classList.add('arus-unified-inner');node.open=true;
          node.querySelector(':scope > summary')?.classList.add('arus-unified-hide-summary');
        }
      }
      section(content,name,node);
    };
    const regroup=()=>{
      // A method can generate both a top-level advanced group and nested source
      // inventory. Move only top-level nodes; never move descendants twice.
      const ship=$('#arus-advanced-ship'),harvald=$('#arus-harvald-settings'),methodDetails=$('#arus-advanced-method');
      move('Ship parameters',ship);
      move('Harvald coefficients and appendages',harvald);
      if(methodDetails&&harvald?.contains(methodDetails)){
        methodDetails.open=true;methodDetails.classList.add('arus-unified-inner');
        methodDetails.querySelector(':scope > summary')?.classList.add('arus-unified-hide-summary');
      }
      if(methodDetails&&!harvald?.contains(methodDetails))move('Method-specific parameters',methodDetails);
      for(const node of [...document.querySelectorAll('.arus-source-inventory,#r01v51-additional')]){
        if(!stored.some(({node:outer})=>outer.contains(node)))move('Appendage source data',node);
      }
      for(const wrap of [...content.querySelectorAll(':scope > .arus-unified-section')]){
        if(!wrap.querySelector(':scope > :not(h3)'))wrap.remove();
      }
      root.hidden=!content.querySelector('input,select,textarea,table');
    };
    let timer;
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(regroup,170);};
    // Source dynamically builds fields after method selection. A limited observer
    // detects new group elements without interfering with in-place calculations.
    const observer=new MutationObserver(()=>{
      if(['arus-advanced-ship','arus-advanced-method','arus-harvald-settings'].some(id=>{
        const node=document.getElementById(id);return node&&!stored.some(({node:outer})=>outer===node||outer.contains(node));
      }))schedule();
    });
    observer.observe(container,{childList:true,subtree:true});
    method.addEventListener('change',()=>{restore();root.open=false;},true);
    method.addEventListener('change',schedule);
    schedule();
    document.body.classList.add('arus-v97-unified');
    return;
  }
  if(module==='model-test'){
    const layout=$('main.layout'),columns=layout?[...layout.querySelectorAll(':scope > .col')]:[];
    if(columns.length<2)return;
    const left=columns[0],right=columns[1],panels=[...left.querySelectorAll(':scope > section.panel')];
    if(panels.length<4)return;
    const [methodPanel,geometryPanel,testPanel,methodSettingsPanel]=panels;
    const method=$('#method');
    const {root,content}=createAdvanced(left,null);
    const env=$('#detailsEnv'),block=$('#blockDetails');
    const adopt=(name,detail)=>{
      if(!detail)return;
      const body=detail.querySelector(':scope > .detailbody');
      if(body){section(content,name,body);detail.closest('.advanced')?.remove();}
    };
    adopt('Water properties and environment',env);
    adopt('Blockage correction',block);
    // Method settings stay in their source section, but only one advanced menu is exposed.
    section(content,'Method coefficients and overrides',methodSettingsPanel);
    const steps=make('div','arus-workflow-steps');steps.setAttribute('aria-label','Calculation workflow');
    ['1. Choose method','2. Enter inputs','3. Results'].forEach((x,i)=>{const span=make('span','',x);span.dataset.stage=['method','input','result'][i];steps.append(span);});
    methodPanel.prepend(steps);
    const cards=methodPanel.querySelectorAll('.arus-method-card');
    const heading=methodPanel.querySelector('.phead h2');if(heading)heading.textContent='Choose extrapolation method';
    const subtitle=make('p','arus-v97-hint','Choose a method to display the required model-test inputs.');methodPanel.append(subtitle);
    const chosenBar=make('div','arus-v97-chosen-bar');
    const chosenName=make('strong','','');
    const changeBtn=make('button','arus-v97-outline','Change Method');changeBtn.type='button';
    chosenBar.append(chosenName,changeBtn);methodPanel.append(chosenBar);
    const actions=make('div','arus-flow-bottom-actions');
    const run=make('button','arus-flow-action','Run Calculation');run.id='arus-v97-run-model-test';run.type='button';actions.append(run);
    left.append(actions);
    const resultPanels=[...right.querySelectorAll(':scope > section.panel')];
    let stage='method';
    const draw=()=>{
      document.body.classList.add('arus-v97-unified','arus-v97-model-test');
      document.body.dataset.arusV97Stage=stage;
      geometryPanel.hidden=stage==='method';testPanel.hidden=stage==='method';root.hidden=stage==='method';
      resultPanels.forEach(panel=>panel.hidden=stage!=='result');
      chosenBar.hidden=stage==='method';subtitle.hidden=stage!=='method';
      chosenName.textContent=method.selectedOptions[0]?.textContent?.replace(/^MT\d+\s*—\s*/, '')||'Selected method';
      steps.dataset.active=stage;
      [...steps.children].forEach((node,i)=>{node.classList.toggle('is-active',['method','input','result'][i]===stage);node.classList.toggle('is-complete',i<['method','input','result'].indexOf(stage));});
      // Source cards must remain in the DOM to keep native method changes intact.
      methodPanel.classList.toggle('arus-v97-method-picked',stage!=='method');
    };
    const afterChoice=()=>{stage='input';draw();geometryPanel.scrollIntoView({block:'start',behavior:'smooth'});};
    methodPanel.addEventListener('click',e=>{if(e.target.closest('.arus-method-card'))setTimeout(afterChoice,0)});
    method.addEventListener('change',()=>{if(stage!=='method'){stage='input';draw();}});
    changeBtn.addEventListener('click',()=>{stage='method';draw();methodPanel.scrollIntoView({block:'start',behavior:'smooth'});});
    left.addEventListener('input',e=>{if(stage==='result'&&e.target.matches('input,select')){stage='input';draw();}},true);
    left.addEventListener('change',e=>{if(stage==='result'&&e.target.matches('input,select')){stage='input';draw();}},true);
    run.addEventListener('click',()=>{
      // The original source automatically recomputes on input. Trigger that unmodified source path.
      (document.getElementById('selectedRun')||method).dispatchEvent(new Event('input',{bubbles:true}));
      stage='result';draw();right.scrollIntoView({block:'start',behavior:'smooth'});
    });
    draw();
    return;
  }
  if(module==='selection'){
    for(const prefix of ['kt','kq']){
      const form=$('#'+prefix+'-inputForm'),fields=form?.querySelector('.fields');
      if(!form||!fields)continue;
      const {root,content}=createAdvanced(form,form.querySelector('.actionbox')||null);
      const families=[
        ['Environment and immersion',['h','rho','nu','p0','pv']],
        ['Powertrain and numerical settings',['etas','etat','eps']],
        ['Cavitation screening',['criterion','safety']]
      ];
      const moveFields=()=>{
        for(const [title,keys] of families){
          let wrap=[...content.querySelectorAll(':scope > .arus-unified-section')].find(x=>x.dataset.group===title);
          if(!wrap){wrap=make('section','arus-unified-section');wrap.dataset.group=title;
            wrap.append(make('h3','arus-unified-group-title',title),make('div','arus-v97-advanced-grid'));
            content.append(wrap);
          }
          const grid=wrap.querySelector('.arus-v97-advanced-grid');
          for(const key of keys){
            const el=form.querySelector(`[id="${prefix}-field-${key}"]`);
            const field=el?.closest('.field');if(field&&field.parentElement!==grid)grid.append(field);
          }
          wrap.hidden=!grid.querySelector('input,select');
        }
        root.hidden=!content.querySelector('input,select');
      };
      let timer;
      const schedule=()=>{clearTimeout(timer);timer=setTimeout(moveFields,80);};
      new MutationObserver(mutations=>{
        if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(
          n.matches?.('.field')||n.querySelector?.('.field')))))schedule();
      }).observe(fields,{childList:true,subtree:true});
      schedule();
      document.getElementById('method-'+prefix)?.addEventListener('click',schedule);
    }
    document.body.classList.add('arus-v97-unified','arus-v97-selection');
    return;
  }
  if(module==='interaction'||module==='interaction-grouped'){
    // No method-independent technical fields are hidden: every field of the chosen
    // interaction equation is an explicitly required input in its source method.
    document.body.classList.add('arus-v97-unified','arus-v97-interaction');
  }
 };
 document.addEventListener('DOMContentLoaded',init);
})();


/* v99 visual bridge: communicates presentation stages only. Source calculator scripts unchanged. */
(()=>{
 'use strict';
 function start(){
  const module=document.documentElement.dataset.arusModule;
  if(!['resistance','model-test','selection','interaction'].includes(module))return;
  document.body.classList.add('arus99-approved');
  const send=(stage,method='')=>window.parent.postMessage({channel:'arus-v99-ui',module,stage,method},'*');
  if(module==='selection'){
   const bar=document.querySelector('#methodBar');
   if(bar){
    const selected=document.createElement('div');selected.className='arus99-selected-choice';
    const details=document.createElement('div'),title=document.createElement('strong'),hint=document.createElement('span');
    const change=document.createElement('button');change.type='button';change.textContent='Change Method';
    details.append(title,hint);selected.append(details,change);bar.append(selected);
    const synchronize=()=>{
      const k=document.body.dataset.arusFlowMethod||'kt';
      title.textContent=k==='kq'?'KQ Power':'KT Ship';
      hint.textContent=k==='kq'?'Power and RPM-based matching':'Resistance and diameter-based matching';
    };
    change.addEventListener('click',()=>{
      const k=document.body.dataset.arusFlowMethod||'kt';
      document.getElementById('arus-flow-change-'+k)?.click();
    });
    new MutationObserver(synchronize).observe(document.body,{attributes:true,attributeFilter:['data-arus-flow-method']});
    synchronize();
   }
   for(const prefix of ['kt','kq']){
     const form=document.getElementById(prefix+'-inputForm');
     if(!form)continue;
     form.addEventListener('submit',()=>{
       setTimeout(()=>{
         const engine=window[prefix==='kt'?'__ARUS_KT__':'__ARUS_INVERSE__'];
         const current=engine?.getState?.();
         const err=document.getElementById(prefix+'-error');
         if(current?.selected&&!err?.classList.contains('visible')&&document.body.dataset.arusFlowMethod===prefix){
           document.body.dataset.arusFlowStage='result';
           send('result',prefix==='kt'?'KT Ship':'KQ Power');
         }
       },1250);
     });
     const reset=()=>{
       if(document.body.dataset.arusFlowMethod===prefix&&document.body.dataset.arusFlowStage==='result'){
         document.body.dataset.arusFlowStage='input';send('input',prefix==='kt'?'KT Ship':'KQ Power');
       }
     };
     form.addEventListener('input',reset,true);
     form.addEventListener('change',reset,true);
   }
  }
  let last='';
  const snapshot=()=>{
   let stage='method',method='';
   if(module==='resistance'){
    method=document.querySelector('.arus-hull-current-name')?.textContent?.trim()||'';
    if(document.body.classList.contains('arus-flow-chosen'))stage=document.querySelector('#resultPanel.arus-flow-visible-result')?'result':'input';
   }else if(module==='model-test'){
    stage=document.body.dataset.arusV97Stage||'method';
    method=document.querySelector('#method')?.selectedOptions?.[0]?.textContent?.trim()||'';
   }else if(module==='selection'){
    stage=document.body.dataset.arusFlowStage||'method';
    method=document.body.dataset.arusFlowMethod==='kt'?'KT Ship':document.body.dataset.arusFlowMethod==='kq'?'KQ Power':'';
   }else if(module==='interaction'){
    const sections=[...document.querySelectorAll('main .sheet > section.block')];
    stage=sections.length>=3?(sections[2].hidden?'input':'result'):'method';
    if(sections[1]?.hidden)stage='method';
    method=document.querySelector('#groupSelect')?.selectedOptions?.[0]?.textContent?.trim()||'';
   }
   const key=stage+'|'+method;if(key!==last){last=key;send(stage,method);}
  };
  // Only observe presentation changes and user actions. No writes to calculation values.
  document.addEventListener('click',()=>setTimeout(snapshot,120),true);
  document.addEventListener('change',()=>setTimeout(snapshot,120),true);
  document.addEventListener('submit',()=>setTimeout(snapshot,650),true);
  setTimeout(snapshot,240);setTimeout(snapshot,900);
 }
 document.addEventListener('DOMContentLoaded',start);
})();
