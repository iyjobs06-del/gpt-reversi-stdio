import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { loadHtml } from './server.mjs';
import { GameStore } from './game.mjs';

// Executes the delivered HTML/bridge/handoff with a deterministic host and clock.
// No host UI or GPT is simulated as success: these are exception-path tests only.
async function boot({ deliveryError=false, readError=false, noInitialReply=false, initialRows=null, initialTurn='B' }={}) {
  const elements=new Map(), listeners=new Map(), timers=new Map(), calls=[];
  let id=0,time=0,reads=0,messages=0;
  function element() {return {textContent:'',hidden:false,disabled:false,attributes:{},children:[],setAttribute(k,v){this.attributes[k]=v;},append(child){this.children.push(child);},replaceChildren(...children){this.children=children;}};}
  const $=name=>{if(!elements.has(name)) elements.set(name,element()); return elements.get(name);};
  $('retry').hidden=true;
  const store=new GameStore(), initial=store.create();
  if(initialRows){store.get(initial.gameId).board=initialRows.join('').split('');store.get(initial.gameId).turn=initialTurn;}
  const emit=message=>listeners.get('message')?.({source:parent,origin:'https://host.test',data:message});
  const parent={postMessage(message){
    calls.push(message);
    if(!message.id)return;
    if(noInitialReply&&message.method==='ui/initialize')return;
    let result;
    try {
      if(message.method==='ui/initialize')result={hostCapabilities:{message:{}}};
      else if(message.method==='ui/message'){messages++;result=deliveryError?{isError:true}:{};}
      else if(message.method==='tools/call') {
        const {name,arguments:args}=message.params;
        if(name==='reversi_read_board'){reads++; if(readError&&reads>1)throw Error('read failed');result={structuredContent:store.snapshot(args.gameId)};}
        else if(name==='reversi_human_move')result={structuredContent:store.move(args,'B')};
        else throw Error('unexpected app tool');
      } else throw Error('unexpected method');
      queueMicrotask(()=>emit({jsonrpc:'2.0',id:message.id,result}));
    } catch(error) {queueMicrotask(()=>emit({jsonrpc:'2.0',id:message.id,error:{message:error.message}}));}
  }};
  const window={parent,addEventListener(name,callback){listeners.set(name,callback);}};
  const context={window,document:{getElementById:$,createElement:element},crypto:webcrypto,console,
    setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:time+ms});return key;},clearTimeout(key){timers.delete(key);}};
  const html=await loadHtml(), script=html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
  const started=runInNewContext('(async()=>{'+script+'})();',context);
  const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
  await settle();
  if(!noInitialReply){await started;emit({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:store.snapshot(initial.gameId)}});await settle();}
  const advance=async(limit)=>{while(timers.size){const [key,item]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(item.at>limit)break;time=item.at;timers.delete(key);item.fn();await settle();}time=limit;};
  return {$,store,gameId:initial.gameId,calls,settle,advance,started,get messages(){return messages;},get reads(){return reads;},get timerCount(){return timers.size;},blackButtons:()=>$('board').children.filter(x=>!x.disabled)};
}

test('actual UI times out an unresponsive GPT and safely stops without retrying or accepting black',async()=>{
  const ui=await boot(); assert.equal(ui.blackButtons().length,4);
  ui.blackButtons().find(x=>x.attributes['aria-label'].startsWith('D3 ')).onclick();await ui.settle();
  assert.equal(ui.store.snapshot(ui.gameId).revision,1);assert.equal(ui.messages,1);assert.equal(ui.blackButtons().length,0);
  await ui.advance(181000);
  assert.match(ui.$('error').textContent,/白の着手がまだ届いていません/);
  assert.equal(ui.timerCount,0);assert.equal(ui.messages,1);assert.equal(ui.blackButtons().length,0);assert.equal(ui.store.snapshot(ui.gameId).revision,1);
});

test('actual UI delivery/read/initialization failures show errors and do not mutate or retry silently',async()=>{
  for(const options of [{deliveryError:true},{readError:true}]) {
    const ui=await boot(options);ui.blackButtons()[0].onclick();await ui.settle();await ui.advance(4000);
    assert.notEqual(ui.$('error').textContent,'');assert.equal(ui.messages,1);assert.equal(ui.blackButtons().length,0);assert.equal(ui.store.snapshot(ui.gameId).revision,1);
  }
  const ui=await boot({noInitialReply:true});await ui.advance(16000);await ui.started;
  assert.match(ui.$('error').textContent,/タイムアウト/);assert.equal(ui.blackButtons().length,0);assert.equal(ui.store.snapshot(ui.gameId).revision,0);
});

test('actual UI displays draw/black win/white win and disables all squares at terminal state',async()=>{
  for(const [rows,expected] of [[Array(8).fill('BBBBWWWW'),'引き分け'],[Array(8).fill('BBBBBBBB'),'あなたの勝ち'],[Array(8).fill('WWWWWWWW'),'GPTの勝ち']]) {
    const ui=await boot({initialRows:rows,initialTurn:'finished'});
    assert.match(ui.$('status').textContent,new RegExp(expected));assert.equal(ui.blackButtons().length,0);assert.equal(ui.messages,0);
  }
});
