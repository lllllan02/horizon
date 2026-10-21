import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {mkdtemp, mkdir, writeFile, readFile, rename, rm, symlink} from 'node:fs/promises';
import {loadLibrary} from '../src/library.ts';
import {activityForLibrary, metadataEvents, exportActivity, migrateActivity} from '../src/activity.ts';
import {withApplicationDatabase, applicationDatabaseExists, APPLICATION_DATABASE} from '../src/app-database.ts';
import {activityDay, filterActivity, dailyItems, dayDetails, periodStart, yearCells, summaryCounts} from '../src/neural/activity-model.ts';
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'horizon-activity-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for (const dir of ['readings','notes','assets']) await mkdir(path.join(root,dir));
  return root;
}
const now = '2026-10-12T10:00:00+08:00';
const raw = '---\ntitle: A\ncreated_at: 2026-10-01\nupdated_at: 2026-10-05\n---\n内容 ![](assets/figure.png)';
const observe = async root => activityForLibrary(root, await loadLibrary(root), {observe:true,now});

test('首次启动只回填明确日期，已有图片仅建基线；重复读取不增加记录',async t=>{
  const root=await fixture(t);
  await writeFile(path.join(root,'readings/a.md'),raw);
  await writeFile(path.join(root,'assets/figure.png'),'image bytes');
  const a=await observe(root);
  assert.deepEqual(a.events.map(e=>e.kind),['created','updated']);
  assert.equal(a.startedAt,now);
  const before=await exportActivity(root);
  const bytes=await readFile(path.join(root,APPLICATION_DATABASE));
  assert.deepEqual(await observe(root),a);
  assert.deepEqual(await exportActivity(root),before);
  assert.deepEqual(await readFile(path.join(root,APPLICATION_DATABASE)),bytes);
  await assert.rejects(readFile(path.join(root,'.activity.json')),{code:'ENOENT'});
  assert.equal(metadataEvents([{id:'b',title:'B',collection:'readings',updated:'2026-10-02'}]).length,1);
});

test('新活动使用北京时间毫秒记录，旧时间表示保留原值',async t=>{
  const root=await fixture(t);
  const file=path.join(root,'notes/a.md');
  const legacy='2026-10-01T00:00:00Z';
  await writeFile(file,`---\ntitle: A\ncreated_at: ${legacy}\n---\n正文`);
  const initial=await activityForLibrary(root,await loadLibrary(root),{observe:true,now:legacy});
  await writeFile(file,`---\ntitle: A\ncreated_at: ${legacy}\n---\n修改正文`);
  t.mock.method(Date,'now',()=>Date.parse('2026-10-20T16:00:00.123Z'));
  const updated=await activityForLibrary(root,await loadLibrary(root),{observe:true});
  assert.equal(updated.startedAt,legacy);
  assert.deepEqual(updated.events.slice(0,initial.events.length),initial.events);
  assert.equal(updated.events.at(-1).time,'2026-10-21 00:00:00.123');
  const newRoot=await fixture(t);
  const fresh=await activityForLibrary(newRoot,await loadLibrary(newRoot),{observe:true});
  assert.equal(fresh.startedAt,'2026-10-21 00:00:00.123');
});

test('记录跨目录迁移、正文变更及新配图和格式，目录筛选不重复计数',async t=>{
  const root=await fixture(t);
  await writeFile(path.join(root,'readings/a.md'),raw);
  await writeFile(path.join(root,'assets/figure.png'),'image bytes');
  await observe(root);
  await rename(path.join(root,'readings/a.md'),path.join(root,'notes/a.md'));
  await writeFile(path.join(root,'notes/a.md'),raw+'\n补充正文');
  await writeFile(path.join(root,'assets/figure.svg'),'<svg/>');
  await writeFile(path.join(root,'assets/new.png'),'new image');
  await writeFile(path.join(root,'assets/new.svg'),'<svg/>');
  const activity=await observe(root), events=activity.events.filter(e=>e.source==='observed');
  assert.deepEqual(events.map(e=>e.kind).sort(),['image-created','image-format','moved','updated']);
  const move=events.find(e=>e.kind==='moved');
  assert.deepEqual(move.collections,['readings','notes']);
  assert.equal(filterActivity(events,'notes','moved').length,1);
  assert.equal(filterActivity(events,'readings','moved').length,1);
  assert.equal(dailyItems(filterActivity(events,'notes')).get('2026-10-12'),2);
  assert.equal(events.find(e=>e.kind==='image-created').files.length,2);
  const snapshot=await activityForLibrary(root,await loadLibrary(root),{publicExport:true});
  assert.ok(!snapshot.events.some(e=>e.entity==='image:assets/new'));
  assert.ok(snapshot.events.every(e=>!e.files));
});

test('导出不创建记录文件；损坏记录及符号链接不会被覆盖',async t=>{
  const root=await fixture(t);
  await writeFile(path.join(root,'readings/a.md'),raw);
  await activityForLibrary(root,await loadLibrary(root));
  await assert.rejects(readFile(path.join(root,'.activity.json')),{code:'ENOENT'});
  await writeFile(path.join(root,'.activity.json'),'{bad');
  assert.ok((await observe(root)).error);
  assert.equal(await readFile(path.join(root,'.activity.json'),'utf8'),'{bad');
  await rm(path.join(root,'.activity.json'));
  await writeFile(path.join(root,'target.json'),'{}');
  await symlink(path.join(root,'target.json'),path.join(root,'.activity.json'));
  assert.ok((await observe(root)).error);
  assert.equal(await readFile(path.join(root,'target.json'),'utf8'),'{}');
});

test('北京时间跨日、周一边界、闰年和重复活动口径',()=>{
  assert.equal(activityDay('2026-10-11T17:00:00Z'),'2026-10-12');
  assert.equal(activityDay('2026-02-30'),null);
  assert.equal(periodStart('2026-10-12','week'),'2026-10-12');
  assert.equal(periodStart('2026-10-18','week'),'2026-10-12');
  const cells=yearCells('2024');
  assert.ok(cells.includes('2024-02-29'));
  assert.equal(cells.length%7,0);
  const base={entity:'doc:a',time:now,collections:['readings','notes'],source:'observed',title:'A'};
  const events=[{...base,id:'1',kind:'updated'},{...base,id:'2',kind:'updated'},{...base,id:'3',kind:'state-changed',from:'pending',to:'organized'}];
  assert.equal(dailyItems(events).get('2026-10-12'),1);
  assert.equal(dayDetails(events,'2026-10-12').length,2);
  assert.equal(summaryCounts(events,'2026-10-01','2026-10-12').learned,1);
  assert.equal(summaryCounts(events,'2026-10-01','2026-10-12').updated,1);
});

test('活动记录深层字段损坏时报告错误并保留原文件', async t => {
  const root=await fixture(t);
  await writeFile(path.join(root,'readings/a.md'),raw);
  await observe(root);
  const file=path.join(root,'.activity.json');
  const original=await exportActivity(root);
  await rm(path.join(root,APPLICATION_DATABASE));
  for(const mutate of [
    s=>s.documents.a=null,
    s=>s.images.test={title:'x',files:[],collections:['notes']},
    s=>s.events[0].collections=[1],
    s=>s.events[0].kind='unknown',
    s=>s.events[0]=null,
  ]) {
    const value=structuredClone(original);mutate(value);const broken=JSON.stringify(value);
    await writeFile(file,broken);assert.ok((await observe(root)).error);
    assert.equal(await readFile(file,'utf8'),broken);
  }
});


test('旧JSON一次迁入SQLite且源文件保留，导出完整等价，不重复迁移', async t => {
  const root=await fixture(t);
  await writeFile(path.join(root,'readings/a.md'),raw);
  await observe(root);
  const initial=await exportActivity(root);
  await rm(path.join(root,APPLICATION_DATABASE));
  const legacy=JSON.stringify(initial,null,2)+'\n';
  await writeFile(path.join(root,'.activity.json'),legacy);
  const readonly=await activityForLibrary(root,await loadLibrary(root),{publicExport:true});
  assert.equal(await applicationDatabaseExists(root),false);
  assert.deepEqual(readonly.events,initial.events);
  await migrateActivity(root);
  assert.deepEqual(await exportActivity(root),initial);
  assert.equal(await readFile(path.join(root,'.activity.json'),'utf8'),legacy);
  await writeFile(path.join(root,'.activity.json'),'{no longer authoritative');
  await migrateActivity(root);
  assert.deepEqual(await exportActivity(root),initial);
  const same=await observe(root);
  assert.deepEqual(same.events,initial.events);
  await writeFile(path.join(root,'readings/a.md'),raw+'\n修改');
  const updated=await observe(root);
  assert.equal(updated.events.length,initial.events.length+1);
  assert.deepEqual(updated.events.slice(0,-1),initial.events);
  assert.equal((await exportActivity(root)).documents.a.bodyDigest!==initial.documents.a.bodyDigest,true);
  assert.equal(await readFile(path.join(root,'.activity.json'),'utf8'),'{no longer authoritative');
});

test('重复ID的旧活动不创建数据库；仅其他数据已初始化时只读仍读取旧活动', async t => {
  const root=await fixture(t);
  const event={id:'duplicate',kind:'created',time:now,entity:'doc:a',docId:'a',title:'A',collections:['readings'],source:'observed'};
  const state={schema:1,startedAt:now,documents:{},images:{},events:[event,event]};
  const legacy=path.join(root,'.activity.json');
  await writeFile(legacy,JSON.stringify(state));
  await assert.rejects(migrateActivity(root),/格式/);
  assert.equal(await applicationDatabaseExists(root),false);
  state.events.pop();
  await writeFile(legacy,JSON.stringify(state));
  await withApplicationDatabase(root,()=>{});
  await writeFile(path.join(root,'readings/a.md'),raw);
  const read=await activityForLibrary(root,await loadLibrary(root));
  assert.deepEqual(read.events,state.events);
  assert.equal(await withApplicationDatabase(root,db=>db.prepare("SELECT value FROM app_metadata WHERE key='activity_imported'").get(),{readonly:true}),undefined);
});

test('SQLite仅追加新事件及更新变化快照，无变化轮询复用公开活动缓存', async t => {
  const root=await fixture(t);
  await writeFile(path.join(root,'notes/a.md'),raw);
  await writeFile(path.join(root,'notes/b.md'),'稳定正文');
  const library=await loadLibrary(root);
  const first=await activityForLibrary(root,library,{observe:true,now});
  assert.equal(await activityForLibrary(root,library,{observe:true,now}),first);
  await withApplicationDatabase(root,db=>db.exec(`
    CREATE TRIGGER retain_events BEFORE UPDATE ON activity_events BEGIN SELECT RAISE(ABORT, 'rewrote history'); END;
    CREATE TRIGGER retain_other BEFORE UPDATE ON activity_documents WHEN OLD.id = 'b' BEGIN SELECT RAISE(ABORT, 'rewrote unrelated'); END;
  `));
  await writeFile(path.join(root,'notes/a.md'),raw+'\n新正文');
  const next=await observe(root);
  assert.equal(next.error,undefined);
  assert.equal(next.events.length,first.events.length+1);
  assert.deepEqual(next.events.slice(0,-1),first.events);
  assert.deepEqual((await activityForLibrary(root,await loadLibrary(root))).events,next.events);
});

test('SQLite快照和结构损坏时提示并保留数据，不重建或覆盖', async t => {
  const root=await fixture(t);
  await writeFile(path.join(root,'notes/a.md'),raw);
  await observe(root);
  await withApplicationDatabase(root,db=>db.prepare('UPDATE activity_documents SET data = ? WHERE id = ?').run('broken','a'));
  assert.ok((await observe(root)).error);
  await assert.rejects(exportActivity(root));
  assert.equal(await withApplicationDatabase(root,db=>db.prepare('SELECT data FROM activity_documents WHERE id = ?').get('a').data,{readonly:true}),'broken');
  await withApplicationDatabase(root,db=>db.exec('DROP TABLE activity_events'));
  assert.ok((await observe(root)).error);
});


test('新活动写入失败整个事务回滚，旧历史和快照保持并可重试', async t => {
  const root=await fixture(t);
  await writeFile(path.join(root,'notes/a.md'),raw);
  await observe(root);
  const before=await exportActivity(root);
  await withApplicationDatabase(root,db=>db.exec("CREATE TRIGGER reject_new_event BEFORE INSERT ON activity_events BEGIN SELECT RAISE(ABORT, 'test failure'); END;"));
  await writeFile(path.join(root,'notes/a.md'),raw+'\n变更');
  assert.ok((await observe(root)).error);
  assert.deepEqual(await exportActivity(root),before);
  await withApplicationDatabase(root,db=>db.exec('DROP TRIGGER reject_new_event'));
  const next=await observe(root);
  assert.equal(next.error,undefined);
  assert.equal(next.events.length,before.events.length+1);
});

test('多进程同时观察同一变化只追加一次，当前进程缓存及时读取外部事件', async t => {
  const root=await fixture(t);
  await writeFile(path.join(root,'notes/a.md'),raw);
  const before=await observe(root);
  await writeFile(path.join(root,'notes/a.md'),raw+'\n外部变更');
  const script=`
    import {activityForLibrary} from './src/activity.ts';
    import {loadLibrary} from './src/library.ts';
    const root=process.env.ACTIVITY_TEST_ROOT;
    const result=await activityForLibrary(root,await loadLibrary(root),{observe:true,now:'2026-10-13 10:00:00.000'});
    if(result.error)throw Error(result.error);
  `;
  const run=()=>promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env:{...process.env,ACTIVITY_TEST_ROOT:root}});
  await Promise.all([run(),run()]);
  const next=await observe(root);
  assert.equal(next.events.length,before.events.length+1);
  assert.equal(next.events.at(-1).time,'2026-10-13 10:00:00.000');
  assert.equal(new Set(next.events.map(e=>e.id)).size,next.events.length);
});

test('坏数据库事件不会被作为有效历史导出或随下一次观察覆盖', async t => {
  const root=await fixture(t);
  await writeFile(path.join(root,'notes/a.md'),raw);
  await observe(root);
  await withApplicationDatabase(root,db=>{
    db.prepare('UPDATE activity_events SET event = ? WHERE seq = 1').run('{bad');
    db.prepare("UPDATE app_metadata SET value = 'external-change' WHERE key = 'activity_revision'").run();
  });
  await assert.rejects(exportActivity(root));
  await writeFile(path.join(root,'notes/a.md'),raw+'\n修改');
  assert.ok((await observe(root)).error);
  assert.equal(await withApplicationDatabase(root,db=>db.prepare('SELECT event FROM activity_events WHERE seq = 1').get().event,{readonly:true}),'{bad');
  assert.equal(await withApplicationDatabase(root,db=>db.prepare('SELECT count(*) AS count FROM activity_events').get().count,{readonly:true}),2);
});


test('无旧JSON的预迁移保持未观察语义，首次观察仅建基线和文档日期', async t => {
  const root=await fixture(t);
  await writeFile(path.join(root,'notes/a.md'),raw);
  await writeFile(path.join(root,'assets/figure.png'),'existing image');
  await migrateActivity(root);
  assert.deepEqual(await exportActivity(root),{schema:1,startedAt:null,documents:{},images:{},events:[]});
  const first=await observe(root);
  assert.equal(first.error,undefined);
  assert.equal(first.startedAt,now);
  assert.deepEqual(first.events,metadataEvents((await loadLibrary(root)).documents));
  assert.ok(first.events.every(event=>event.source==='metadata'));
  assert.equal(Object.keys((await exportActivity(root)).images).length,1);
  assert.deepEqual(await observe(root),first);
  await writeFile(path.join(root,'assets/new.png'),'new image');
  const next=await observe(root);
  assert.deepEqual(next.events.filter(event=>event.source==='observed').map(event=>[event.kind,event.entity]),[['image-created','image:assets/new']]);
});

test('空JSON恢复也等待首个基线；startedAt为空但有快照或历史时完整保留', async t => {
  const emptyRoot=await fixture(t);
  await writeFile(path.join(emptyRoot,'notes/a.md'),raw);
  await writeFile(path.join(emptyRoot,'.activity.json'),JSON.stringify({schema:1,startedAt:null,documents:{},images:{},events:[]}));
  await migrateActivity(emptyRoot);
  assert.ok((await observe(emptyRoot)).events.every(event=>event.source==='metadata'));

  const root=await fixture(t);
  await writeFile(path.join(root,'notes/a.md'),raw);
  await writeFile(path.join(root,'assets/figure.png'),'image');
  await observe(root);
  const legacy=await exportActivity(root);
  legacy.startedAt=null;
  await rm(path.join(root,APPLICATION_DATABASE));
  await writeFile(path.join(root,'.activity.json'),JSON.stringify(legacy));
  await migrateActivity(root);
  assert.deepEqual(await exportActivity(root),legacy);
  await writeFile(path.join(root,'notes/a.md'),raw+'\n变更');
  const next=await observe(root);
  assert.deepEqual(next.events.slice(0,legacy.events.length),legacy.events);
  assert.deepEqual(next.events.slice(legacy.events.length).map(event=>event.kind),['updated']);
  assert.equal(next.startedAt,now);
});
