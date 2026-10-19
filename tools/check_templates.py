"""Publisher tests only in /tmp. Production is never modified."""
import copy,importlib.util,json,tempfile,unittest
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
if __name__=='__main__':unittest.main(verbosity=2)
