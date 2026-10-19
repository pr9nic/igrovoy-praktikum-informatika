"""Publisher tests only in /tmp. Production is never modified."""
import contextlib,copy,importlib.util,io,json,re,shutil,sys,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('publisher',Path(__file__).with_name('publish.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class Checks(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='school4-publisher-check-');self.base=Path(self.tmp.name)
        self.realroot=p.ROOT;p.ROOT=self.base/'project';p.ROOT.mkdir();(p.ROOT/'drafts').mkdir();(p.ROOT/'backups').mkdir(mode=0o700)
        self.realsite=p.SITE;p.SITE=self.base/'site';(p.SITE/'portal').mkdir(parents=True);(p.SITE/'portal/catalog.json').write_text('[{"id":"existing","url":"/test6/","title":"Старое задание"}]')
        self.source=p.ROOT/'drafts/test.json';self.data=json.loads((self.realroot/'templates/test.json').read_text());self.data['slug']='fixture-binary-check'
        (p.ROOT/'reference').mkdir();(p.ROOT/'reference/bosova-topics.json').write_bytes((self.realroot/'reference/bosova-topics.json').read_bytes())
    def tearDown(self):p.ROOT=self.realroot;p.SITE=self.realsite;self.tmp.cleanup()
    def main(self,*args):
        argv=sys.argv;sys.argv=['publish.py',str(self.source),*args]
        try:
            with contextlib.redirect_stdout(io.StringIO()) as out:p.main()
        finally:sys.argv=argv
        return json.loads(out.getvalue())
    def trainer(self,typ,*levels):
        d=copy.deepcopy(self.data);del d['questions']
        d.update(kind='trainer',story=['Сюжет'],worlds=[{'id':'w1','title':'Мир','description':'Описание','type':typ,'levels':[{'id':'l%d'%i,'title':'Уровень','prompt':'Задание','hint':'Подсказка','explanation':'Разбор',**l} for i,l in enumerate(levels)]}]);return d
    def test_01_all_templates(self):
        for name in ['test','practice','lesson','game']:
            data=json.loads((self.realroot/'templates'/(name+'.json')).read_text());p.validate(data,self.source);out=self.base/name;p.render(data,[],out);self.assertTrue((out/'index.html').is_file());self.assertTrue((out/'teacher_key.html').is_file())
    def test_02_invalid_answers(self):
        for field,value in [('grade',99),('slug','../../bad')]:
            with self.assertRaises(ValueError):p.validate({**self.data,field:value},self.source)
        bad=copy.deepcopy(self.data);bad['questions'][0]['answer']=20
        with self.assertRaises(ValueError):p.validate(bad,self.source)
    def test_03_publish_and_replace(self):
        built=self.base/'built';item=p.render(self.data,[],built);backup=p.publish(self.data,built,item)
        self.assertTrue((backup/'catalog.json').exists());catalog=json.loads((p.SITE/'portal/catalog.json').read_text());self.assertEqual(len(catalog),2);self.assertEqual(catalog[0]['id'],'existing')
        with self.assertRaises(ValueError):p.publish(self.data,built,item)
        self.data['title']='Обновлённое задание';item=p.render(self.data,[],built);backup2=p.publish(self.data,built,item,True)
        self.assertTrue((backup2/'course/index.html').exists());self.assertEqual(len(json.loads((p.SITE/'portal/catalog.json').read_text())),2)
    def test_04_escaped_markup_and_private_notes(self):
        self.data['title']='<script>alert(1)</script>';self.data['teacherNotes']=['СЕКРЕТНЫЙ_КЛЮЧ_ПРИМЕР']
        built=self.base/'built';p.render(self.data,[],built);page=(built/'index.html').read_text()
        self.assertNotIn('<script>alert(1)</script>',page);self.assertNotIn('СЕКРЕТНЫЙ_КЛЮЧ_ПРИМЕР',page)
    def test_05_attachment_traversal(self):
        outside=self.base/'outside.txt';outside.write_text('test');self.data['attachments']=[{'label':'bad','file':'../../outside.txt'}]
        with self.assertRaises(ValueError):p.validate(self.data,self.source)
    def test_06_rollback(self):
        built=self.base/'built';item=p.render(self.data,[],built);p.publish(self.data,built,item);old=(p.SITE/'courses'/self.data['slug']/'index.html').read_text();original=(p.SITE/'portal/catalog.json').read_text()
        self.data['title']='Неудавшееся обновление';item=p.render(self.data,[],built);atomic=p.atomic
        try:
            p.atomic=lambda *a:(_ for _ in []).throw(OSError('simulated failure'))
            with self.assertRaises(OSError):p.publish(self.data,built,item,True)
        finally:p.atomic=atomic
        self.assertEqual((p.SITE/'courses'/self.data['slug']/'index.html').read_text(),old);self.assertEqual((p.SITE/'portal/catalog.json').read_text(),original)
    def test_07_bosova_metadata(self):
        self.data['curriculum']={'provider':'bosova','seriesId':'bosova-8-frp-basic','topicId':'bosova-8-frp-basic-p-1-2','sourceUrl':'https://bosova.ru/metodist/authors/informatika/3/eor8bufrp.php'}
        p.validate(self.data,self.source);out=self.base/'bosova';item=p.render(self.data,[],out)
        self.assertEqual(item['curriculum'],self.data['curriculum']);self.assertIn('Тема по Босовой',(out/'index.html').read_text())
        p.publish(self.data,out,item);self.assertEqual(json.loads((p.SITE/'portal/catalog.json').read_text())[-1]['curriculum'],self.data['curriculum'])
        for key,value in [('seriesId','missing'),('topicId','missing'),('sourceUrl','https://invalid.example/')]:
            bad=copy.deepcopy(self.data);bad['curriculum'][key]=value
            with self.assertRaises(ValueError):p.validate(bad,self.source)
        with self.assertRaises(ValueError):p.validate({**self.data,'grade':7},self.source)
        with self.assertRaises(ValueError):p.validate({**self.data,'curriculum':None},self.source)
    def test_08_games(self):
        game=json.loads((self.realroot/'templates/game.json').read_text());p.validate(game,self.source)
        bad=copy.deepcopy(game);bad['missions'][0]['topicId']='foreign'
        with self.assertRaises(ValueError):p.validate(bad,self.source)
        bad=copy.deepcopy(game);next(m for m in bad['missions'] if m['type']=='truth')['answer']=[1,1,1,1]
        with self.assertRaises(ValueError):p.validate(bad,self.source)
        bad=copy.deepcopy(game);robot=next(m for m in bad['missions'] if m['type']=='robot');robot['maxMoves']=1
        with self.assertRaises(ValueError):p.validate(bad,self.source)
        bad=copy.deepcopy(game);bad['curriculum']['topicIds'].append('foreign')
        with self.assertRaises(ValueError):p.validate(bad,self.source)
        bad=copy.deepcopy(game);bad['missions'][0]['bits']=2;bad['missions'][0]['answer']=99
        with self.assertRaises(ValueError):p.validate(bad,self.source)
    def test_09_publish_private_build(self):
        # Параллельный запуск переписывает общий build/SLUG: публикуется личная проверенная сборка.
        self.source.write_text(json.dumps(self.data,ensure_ascii=False));publish=p.publish
        def racing(data,built,item,replace=False):
            shutil.rmtree(p.ROOT/'build'/data['slug']);(p.ROOT/'build'/data['slug']).mkdir();return publish(data,built,item,replace)
        try:p.publish=racing;self.assertTrue(self.main('--publish')['published'])
        finally:p.publish=publish
        self.assertTrue((p.SITE/'courses'/self.data['slug']/'index.html').is_file());self.assertTrue((p.SITE/'courses'/self.data['slug']/'teacher_key.html').is_file())
    def test_10_nan_infinity(self):
        # NaN, Infinity и 1e999 ломают JSON.parse на странице.
        for value in ['NaN','Infinity','-Infinity','1e999']:
            self.source.write_text(json.dumps(self.data,ensure_ascii=False)[:-1]+', "extra": '+value+'}')
            with self.assertRaises(ValueError):self.main()
        with self.assertRaises(ValueError):p.render({**self.data,'extra':float('nan')},[],self.base/'nan')
    def test_11_calc_like_browser(self):
        calc=lambda task:self.trainer('calc',*[{'count':3,'tasks':[task]}]*3)
        p.validate(calc({'text':'Сколько будет {a} + {b}?','vars':{'a':[1,2,3],'b':[4,5]},'answer':['+','a','b']}),self.source)
        for task in [{'text':'Путь {скорость} км?','vars':{'скорость':[40,60,80,90]},'answer':'скорость'},   # \w в JS — только латиница
                     {'text':'Последняя цифра {a} в степени {n}?','vars':{'a':[7,3],'n':[30,40]},'answer':['%',['**','a','n'],10]},   # больше 2**53
                     {'text':'Последняя цифра {a}·{b}?','vars':{'a':[123456789,123456787],'b':[123456789,123456781]},'answer':['%',['*','a','b'],10]},
                     {'text':'Сколько {a}?','vars':{'a':[1,2,3,4]},'answer':['/','a',10000000000]}]:   # почти целое
            with self.assertRaises(ValueError):p.validate(calc(task),self.source)
    def test_12_failed_publish_cleanup(self):
        built=self.base/'built';item=p.render(self.data,[],built);copytree=p.shutil.copytree
        def edited(*a,**k):r=copytree(*a,**k);(p.SITE/'portal/catalog.json').write_text('[]');return r   # каталог правят во время копирования
        try:
            p.shutil.copytree=edited
            with self.assertRaises(ValueError):p.publish(self.data,built,item)
        finally:p.shutil.copytree=copytree
        self.assertEqual(list((p.SITE/'courses').iterdir()),[])
    def test_13_interrupt_rollback(self):
        built=self.base/'built';item=p.render(self.data,[],built);p.publish(self.data,built,item);target=p.SITE/'courses'/self.data['slug'];old=(target/'index.html').read_text()
        self.data['title']='Прерванное обновление';item=p.render(self.data,[],built);rename=Path.rename
        def interrupted(path,dst):
            if path.name.startswith('.school4-author-'):raise KeyboardInterrupt   # Ctrl+C между двумя переименованиями
            return rename(path,dst)
        try:
            Path.rename=interrupted
            with self.assertRaises(KeyboardInterrupt):p.publish(self.data,built,item,True)
        finally:Path.rename=rename
        self.assertEqual((target/'index.html').read_text(),old);self.assertEqual([x.name for x in target.parent.iterdir()],[self.data['slug']])
    @unittest.skipUnless(importlib.util.find_spec('flask'),'нет Flask')
    def test_14_preview_slug(self):
        spec=importlib.util.spec_from_file_location('preview',Path(__file__).with_name('preview.py'));pv=importlib.util.module_from_spec(spec);spec.loader.exec_module(pv)
        pv.ROOT=p.ROOT;(p.ROOT/'build/demo-page').mkdir(parents=True);(p.ROOT/'build/demo-page/index.html').write_text('ok');(p.ROOT/'drafts/secret.json').write_text('{"teacherNotes":["СЕКРЕТ"]}')
        client=pv.app.test_client()
        for url,code in [('/courses/demo-page/',200),('/courses/%2e%2e/drafts/secret.json',404),('/courses/../drafts/secret.json',404)]:
            with client.get(url) as r:self.assertEqual(r.status_code,code,url)
    def test_15_for_loop_guard(self):
        # Пустое тело for с огромным диапазоном не должно подвешивать проверку.
        level=lambda prog:{'w':5,'h':5,'start':[0,0],'program':prog}
        p.validate(self.trainer('trace',*[level([{'op':'for','var':'i','from':0,'to':3,'body':[{'op':'move','d':'R'}]}])]*3),self.source)
        with self.assertRaises(ValueError):p.validate(self.trainer('trace',*[level([{'op':'for','var':'i','from':0,'to':10**6,'body':[]}]+[{'op':'move','d':'R'}]*3)]*3),self.source)
    def test_16_title_placeholders(self):
        self.data['title']='Шаблон __DATA__ и __GRADE__';p.render(self.data,[],self.base/'out');page=(self.base/'out/index.html').read_text()
        self.assertIn('<title>Шаблон __DATA__ и __GRADE__ · Школа 4</title>',page);self.assertEqual(page.count('"schemaVersion"'),1)
    def test_17_raw_length_and_worlds(self):
        # Предел длины — по исходной строке, а не после strip().
        with self.assertRaises(ValueError):p.validate({**self.data,'title':'Заголовок'+'\n'*200},self.source)
        game=json.loads((self.realroot/'templates/game.json').read_text());game['story'][0]+=' '*3000
        with self.assertRaises(ValueError):p.validate(game,self.source)
        calc={'count':3,'tasks':[{'text':'Сколько будет {a} + {b}?','vars':{'a':[1,2,3],'b':[4,5]},'answer':['+','a','b']}]};t=self.trainer('calc',calc,calc,calc);t['story']=['Сюжет'+' '*1500]
        with self.assertRaises(ValueError):p.validate(t,self.source)
        # docs/GAMES.md и trainer_schema.py называют одно и то же число миров.
        t['story']=['Сюжет'];limit=int(re.search(r'`worlds` 1–(\d+)',(self.realroot/'docs/GAMES.md').read_text()).group(1))
        t['worlds']=[{**t['worlds'][0],'id':'w%d'%n,'levels':[{**l,'id':'w%d-%s'%(n,l['id'])} for l in t['worlds'][0]['levels']]} for n in range(limit+1)]
        with self.assertRaises(ValueError):p.validate(t,self.source)
        t['worlds'].pop();p.validate(t,self.source)
    def test_18_malformed_drafts(self):
        game=json.loads((self.realroot/'templates/game.json').read_text());calc={'count':3,'tasks':[{'text':'{a}','vars':{'a':[1,2,3,4]},'answer':'a'}]}
        bad=[copy.deepcopy(game),copy.deepcopy(game)];bad[0]['missions'][0]['table']=[1,2];next(m for m in bad[1]['missions'] if m['type']=='order')['answer']=[0,'a',1]
        bad+=[self.trainer('calc',{**calc,'play':['race']},calc,calc),self.trainer('trace',*[{'w':5,'h':5,'start':[0,0]}]*3)]
        for d in bad:
            with self.assertRaises(ValueError):p.validate(d,self.source)
        lesson=json.loads((self.realroot/'templates/lesson.json').read_text());lesson['questions']=[{'type':'single'}];p.render(lesson,[],self.base/'lesson')
        (p.SITE/'portal/catalog.json').write_text('[null]');built=self.base/'built';item=p.render(self.data,[],built)
        with self.assertRaises(ValueError):p.publish(self.data,built,item)
        # Прочие ошибки структуры — одна строка «Ошибка: …» с типом исключения, без трассировки.
        trace=self.trainer('trace',*[{'w':5,'h':5,'start':[0,0],'funcs':[],'program':[{'op':'move','d':'R'}]*3}]*3)
        self.source.write_text(json.dumps(trace,ensure_ascii=False));argv=sys.argv;sys.argv=['publish.py',str(self.source)]
        try:
            with self.assertRaises(SystemExit) as error:p.cli()
        finally:sys.argv=argv
        self.assertTrue(str(error.exception.code).startswith('Ошибка: '),error.exception.code)
if __name__=='__main__':unittest.main(verbosity=2)
