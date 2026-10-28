import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStore } from './game.mjs';
import { applyMove, cellIndex, flips } from './engine.mjs';

function fixture(rows,turn) {
  const store = new GameStore(), initial = store.create(), game = store.get(initial.gameId);
  game.board = rows.join('').split(''); game.turn = turn;
  return {store,gameId:initial.gameId,move:(cell,side=turn)=>store.move({gameId:initial.gameId,cell,expectedRevision:store.snapshot(initial.gameId).revision,commandId:crypto.randomUUID()},side)};
}

test('same engine flips all eight directions and rejects non-capturing moves',()=>{
  const board=Array(64).fill('.'), target=cellIndex('D4');
  for(const [dx,dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
    board[(3+dy)*8+3+dx]='W'; board[(3+2*dy)*8+3+2*dx]='B';
  }
  assert.equal(flips(board,target,'B').length,8);
  const after=applyMove(board,'D4','B');
  assert.equal(after.flipped.length,8); assert.equal(after.board.filter(x=>x==='W').length,0);
  assert.throws(()=>applyMove(board,'A8','B'),/Illegal/);
  assert.equal(board[target],'.');
});

test('automatic white pass keeps black turn; automatic black pass keeps white turn',()=>{
  for(const side of ['B','W']) {
    const other=side==='B'?'W':'B';
    const rows=[`.${other}${side.repeat(6)}`,...Array(6).fill(side.repeat(8)),`${side.repeat(6)}${other}.`];
    const game=fixture(rows,side), next=game.move('A1');
    assert.equal(next.turn,side); assert.deepEqual(next.legalMoves,['H8']);
    assert.equal(next.revision,1);
    assert.equal(game.move('H8').turn,'finished');
  }
});

test('both without legal moves ends even with an empty square, rejects moves after finish',()=>{
  const game=fixture(['.WBBBBBB',...Array(6).fill('BBBBBBBB'),'BBBBBBB.'],'B');
  const final=game.move('A1');
  assert.equal(final.turn,'finished'); assert.equal(final.black,63); assert.equal(final.white,0); assert.deepEqual(final.legalMoves,[]);
  assert.throws(()=>game.move('H8'),/手番/); assert.equal(game.store.snapshot(game.gameId).revision,1);
});

test('full board draw counts 32 each, and white win counts correctly',()=>{
  const draw=fixture(['.WBBBBBB',...Array(3).fill('BBBBBBBB'),...Array(4).fill('WWWWWWWW')],'B').move('A1');
  assert.equal(draw.turn,'finished'); assert.equal(draw.black,32); assert.equal(draw.white,32);
  const win=fixture(['.BWWWWWW',...Array(7).fill('WWWWWWWW')],'W').move('A1');
  assert.equal(win.turn,'finished'); assert.equal(win.white,64); assert.equal(win.black,0);
});

test('current game protects duplicate ids, reused ids, wrong turns, invalid cells and stale revisions',()=>{
  const store=new GameStore(), g=store.create();
  const args={gameId:g.gameId,cell:'D3',expectedRevision:0,commandId:'black-once'};
  const first=store.move(args,'B'); assert.deepEqual(store.move(args,'B'),first);
  assert.throws(()=>store.move({...args,cell:'C4'},'B'),/再利用/);
  for(const a of [{...args,commandId:'old',cell:'C3'},{...args,expectedRevision:1,commandId:'illegal',cell:'A1'},{...args,expectedRevision:1,commandId:'format',cell:'Z9'}]) assert.throws(()=>store.move(a,'W'));
  assert.throws(()=>store.move({...args,expectedRevision:1,commandId:'wrong'},'B'),/手番/);
  assert.equal(store.snapshot(g.gameId).revision,1);
});
