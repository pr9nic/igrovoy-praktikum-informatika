#!/usr/bin/env python3
"""Validated static assignment publisher. No root, database or service changes."""
import argparse,fcntl,hashlib,html,json,math,os,re,shutil,tempfile,uuid
from game_schema import validate_game
from typing_escape.schema import validate_typing
from trainer_schema import validate_trainer,draw_public
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SITE=Path('/srv/school4/cdn')
GODOT_FILES=['index.html','index.js','index.wasm','index.pck','index.audio.worklet.js','index.audio.position.worklet.js']
EXTENSIONS={'.pdf','.docx','.xlsx','.ods','.odt','.pptx','.txt','.csv','.py','.sql','.zip','.png','.jpg','.jpeg','.svg'}
def require(value,message):
    if not value:raise ValueError(message)
def text(value,label,limit=3000):
    require(isinstance(value,str) and value.strip() and len(value)<=limit,label+' — обязательная строка допустимой длины')
    require(not any(ord(c)<32 and c not in '\n\t' for c in value),label+' содержит управляющие символы')
def strings(value,label,minimum=0,maximum=20):
    require(isinstance(value,list) and minimum<=len(value)<=maximum,label+' — список неверной длины')
    for item in value:text(item,label)
def validate(data,source):
    require(isinstance(data,dict) and data.get('schemaVersion')==1,'Нужна schemaVersion: 1')
    require(isinstance(data.get('slug'),str) and re.fullmatch(r'[a-z][a-z0-9-]{2,63}',data['slug']),'slug: 3–64 символа a-z, 0-9 и дефис')
    require(data.get('kind') in ['test','practice','lesson','game','trainer'],'kind: test/practice/lesson/game/trainer')
    require(type(data.get('grade')) is int and 6<=data['grade']<=11,'grade: целое 6–11')
    if 'curriculum' in data:
        c=data['curriculum']
        require(isinstance(c,dict) and set(c) in [{'provider','seriesId','topicId','sourceUrl'},{'provider','seriesId','topicId','topicIds','sourceUrl'}] and c.get('provider')=='bosova','curriculum: provider=bosova, seriesId, topicId, sourceUrl; topicIds необязательно')
        ref=json.loads((ROOT/'reference/bosova-topics.json').read_text())
        series=next((s for s in ref['series'] if s['id']==c['seriesId']),None)
        require(series is not None and series['grade']==data['grade'],'Серия Босовой отсутствует или не совпадает класс')
        topic=next((t for t in series['topics'] if t['id']==c['topicId']),None)
        require(topic is not None and c['sourceUrl']==topic['sourceUrl'],'Тема Босовой отсутствует или sourceUrl не совпадает с официальным источником')
        if 'topicIds' in c:
            strings(c['topicIds'],'curriculum.topicIds',1,20)
            require(c['topicId'] in c['topicIds'] and len(set(c['topicIds']))==len(c['topicIds']),'topicIds: уникальные темы, включая основную')
            require(set(c['topicIds'])<={t['id'] for t in series['topics']},'Неизвестные или чужие темы в topicIds')
    for key,limit in [('title',160),('description',600),('subject',60)]:text(data.get(key),key,limit)
    require(type(data.get('durationMinutes')) is int and 5<=data['durationMinutes']<=120,'durationMinutes: 5–120')
    strings(data.get('goals'), 'goals',1,5);strings(data.get('instructions'),'instructions',1,10)
    strings(data.get('theory',[]),'theory',0,12);strings(data.get('teacherNotes',[]),'teacherNotes',0,20)
    strings(data.get('reflection',[]),'reflection',0,5)
    if data['kind']=='game':
        if data.get('gameMode')=='typing-escape':
            validate_typing(data)
        elif data.get('gameMode')=='crew':
            # Сетевая игра «Сбой на станции»: клиент в tools/crew, серверная часть — модуль crew_api журнала.
            require(all((Path(__file__).with_name('crew')/f).is_file() for f in ['crew.js','crew.css']),'Нет файлов tools/crew')
        elif data.get('gameMode')=='lab':
            # «Лаборатория Кодограда»: шесть игр на чистом JS из tools/lab (оболочка core.js и игры в games/).
            lab=Path(__file__).with_name('lab');require((lab/'core.js').is_file() and (lab/'lab.css').is_file() and len(list((lab/'games').glob('*.js')))>=1,'Нет файлов tools/lab')
        elif data.get('gameMode')=='codehero':
            # «Герой кода»: движок и уровни лежат в tools/codehero, в черновике только паспорт и памятка учителя.
            engine=Path(__file__).with_name('codehero')
            require(all((engine/f).is_file() for f in ['core.js','levels.js','ui.js','hero.css','assets/dungeon.png']),'Нет файлов движка tools/codehero')
        elif data.get('gameMode')=='practicum':
            # Игровой практикум: страница «класс → список игр» с отметками; игры берутся из опубликованной игры на Godot.
            pr=data.get('practicum');require(isinstance(pr,dict) and set(pr)=={'apiSlug','godotHost','godotProject','games','links'},'practicum: apiSlug, godotHost, godotProject, games, links')
            require(pr['apiSlug']=='trainer-%d-practicum'%data['grade'],'practicum.apiSlug: trainer-КЛАСС-practicum')
            require(isinstance(pr['godotHost'],str) and re.fullmatch(r'[a-z][a-z0-9-]{2,63}',pr['godotHost']) and (SITE/'courses'/pr['godotHost']/'game'/'index.html').is_file(),'practicum.godotHost: slug опубликованной игры на Godot')
            require(isinstance(pr['godotProject'],str) and re.fullmatch(r'[a-z][a-z0-9-]{1,40}',pr['godotProject']) and (ROOT/'godot'/pr['godotProject']/'export'/'index.pck').is_file(),'practicum.godotProject: нет сборки')
            require(isinstance(pr['games'],list) and 1<=len(pr['games'])<=30,'practicum.games: 1–30 игр');ids=set()
            for g in pr['games']:
                require(isinstance(g,dict) and set(g)-{'url'}=={'id','title','genre','about','art','color','levels','minutes','unit','params'},'Игра практикума: неверный набор полей')
                require('url' not in g or (isinstance(g['url'],str) and re.fullmatch(r'/courses/[a-z][a-z0-9-]{2,63}/',g['url']) and ((SITE/g['url'].strip('/')/'index.html').is_file() or (ROOT/'build'/g['url'].split('/')[2]/'index.html').is_file())),'Игра практикума: url ведёт на несуществующее задание')
                require(isinstance(g['id'],str) and re.fullmatch(r'[a-z][a-z0-9]{1,20}',g['id']) and g['id'] not in ids,'Игра практикума: id');ids.add(g['id'])
                for key,limit in [('title',80),('genre',40),('about',300),('art',12),('unit',30)]:text(g[key],'practicum.'+key,limit)
                require(isinstance(g['color'],str) and re.fullmatch(r'#[0-9a-f]{6}',g['color']),'Игра практикума: color')
                require(type(g['levels']) is int and 1<=g['levels']<=30 and type(g['minutes']) is int and 5<=g['minutes']<=120,'Игра практикума: levels 1–30, minutes 5–120')
                require(isinstance(g['params'],str) and re.fullmatch(r'[a-z]+=[a-z0-9]+(&[a-z]+=[a-z0-9]+)*',g['params']),'Игра практикума: params')
            require(isinstance(pr['links'],list) and len(pr['links'])<=12,'practicum.links: до 12 ссылок')
            for l in pr['links']:
                require(isinstance(l,dict) and set(l)=={'title','about','note','url'},'Ссылка практикума: title, about, note, url')
                for key,limit in [('title',80),('about',300),('note',80)]:text(l[key],'practicum.link.'+key,limit)
                require(isinstance(l['url'],str) and re.fullmatch(r'/courses/[a-z][a-z0-9-]{2,63}/',l['url']) and (SITE/l['url'].strip('/')/'index.html').is_file(),'Ссылка практикума ведёт на неопубликованное задание: '+str(l.get('url')))
        elif data.get('gameMode')=='godot':
            # Игра на Godot: готовый веб-экспорт из godot/ИМЯ/export, собранный командой из docs/GAMES.md.
            name=data.get('godotProject');require(isinstance(name,str) and re.fullmatch(r'[a-z][a-z0-9-]{1,40}',name),'godotProject: имя папки в godot/')
            export=ROOT/'godot'/name/'export'
            require(all((export/f).is_file() and not (export/f).is_symlink() for f in GODOT_FILES),'Нет веб-экспорта Godot: '+str(export))
            require(sum((export/f).stat().st_size for f in GODOT_FILES)<120*1024*1024,'Веб-экспорт Godot больше 120 МБ')
            # godotHost: страница класса показывает игру, уже опубликованную в другом задании (одна копия на сервере).
            require(data.get('godotParams') is None or (isinstance(data['godotParams'],str) and re.fullmatch(r'[a-z]+=[a-z0-9]+(&[a-z]+=[a-z0-9]+)*',data['godotParams'])),'godotParams: параметры вида game=arcade')
            host=data.get('godotHost')
            require(host is None or (isinstance(host,str) and re.fullmatch(r'[a-z][a-z0-9-]{2,63}',host) and host!=data['slug'] and (SITE/'courses'/host/'game'/'index.html').is_file()),'godotHost: slug опубликованной игры на Godot')
        else:
            require(data.get('gameMode') is None,'Неизвестный режим игры')
            require('curriculum' in data,'Игра требует привязки curriculum к темам Босовой')
            validate_game(data)
            require(all(m['topicId'] in data['curriculum'].get('topicIds',[data['curriculum']['topicId']]) for m in data['missions']),'Миссия не привязана к заявленным темам')
    elif data['kind']=='trainer':
        c=data.get('curriculum',{});validate_trainer(data,set(c.get('topicIds',[c['topicId']] if c else [])))
    elif data['kind']=='test':
        qs=data.get('questions');require(isinstance(qs,list) and 3<=len(qs)<=40,'questions: 3–40 вопросов')
        ids=set()
        for q in qs:
            require(isinstance(q,dict),'Вопрос должен быть объектом')
            text(q.get('id'),'question.id',40);require(q['id'] not in ids,'Повторяется id вопроса');ids.add(q['id'])
            text(q.get('prompt'),'prompt');text(q.get('explanation'),'explanation')
            require(type(q.get('points')) is int and 1<=q['points']<=10,'points: 1–10')
            typ=q.get('type');ans=q.get('answer');require(typ in ['single','multi','number','text'],'Неизвестный тип вопроса')
            if typ in ['single','multi']:
                strings(q.get('options'),'options',2,6)
                require(len(set(q['options']))==len(q['options']),'Варианты ответа должны отличаться')
                values=[ans] if typ=='single' else ans
                require(isinstance(values,list) and values and all(type(x) is int and 0<=x<len(q['options']) for x in values),'answer — индекс или индексы вариантов, начиная с 0')
                require(len(set(values))==len(values),'Повторяющиеся правильные индексы')
            if typ=='number':
                require(type(ans) in [int,float] and math.isfinite(ans),'answer — конечное число')
                tol=q.get('tolerance',0);require(type(tol) in [int,float] and math.isfinite(tol) and tol>=0,'tolerance ≥ 0')
            if typ=='text':strings([ans] if isinstance(ans,str) else ans,'answer',1,10)
        scale=data.get('grading');require(isinstance(scale,dict),'Нужна grading')
        require(all(type(scale.get(k)) in [int,float] for k in ['three','four','five']) and 0<scale['three']<scale['four']<scale['five']<=100,'Пороги оценок строго возрастают от 0 до 100')
    else:
        steps=data.get('steps');require(isinstance(steps,list) and 2<=len(steps)<=20,'steps: 2–20 шагов')
        for step in steps:
            require(isinstance(step,dict),'Шаг должен быть объектом');text(step.get('title'),'step.title',160);text(step.get('text'),'step.text')
            if 'example' in step:text(step['example'],'example')
        rubric=data.get('rubric',[])
        require(isinstance(rubric,list) and (2<=len(rubric)<=12 if data['kind']=='practice' else len(rubric)<=12),'rubric: 2–12 критериев для практики')
        for r in rubric:
            require(isinstance(r,dict),'Критерий должен быть объектом');text(r.get('criterion'),'criterion',300)
            require(type(r.get('points')) is int and 1<=r['points']<=20,'rubric.points: 1–20')
        if data['kind']=='practice':text(data.get('deliverable'),'deliverable',600)
    attachments=data.get('attachments',[]);require(isinstance(attachments,list) and len(attachments)<=12,'attachments: не более 12 файлов')
    resolved=[]
    for a in attachments:
        require(isinstance(a,dict),'Вложение должно быть объектом');text(a.get('label'),'attachment.label',160);text(a.get('file'),'attachment.file',200)
        path=source.parent/a['file'];file=path.resolve()
        require(file.is_relative_to(ROOT/'drafts') and file.is_file() and not path.is_symlink(),'Вложение должно быть обычным файлом внутри drafts/')
        require(file.suffix.lower() in EXTENSIONS,'Недопустимое расширение вложения')
        require(file.stat().st_size<=20*1024*1024,'Вложение больше 20 МБ')
        # SVG is code-capable; use only ordinary raster images instead.
        require(file.suffix.lower()!='.svg','SVG не поддерживается — используйте PNG')
        resolved.append((a,file))
    return resolved
def render(data,attachments,output):
    output.mkdir(parents=True,exist_ok=True)
    public={k:v for k,v in data.items() if k not in ['teacherNotes','attachments']}
    if data['kind']=='trainer':
        # Эталонные решения остаются только в ключе учителя.
        public['worlds']=[{**w,'levels':[{k:v for k,v in l.items() if k!='solution'} for l in w['levels']]} for w in data['worlds']]
        for w,src in zip(public['worlds'],data['worlds']):
            if w['type']=='draw':
                for l,full in zip(w['levels'],src['levels']):l['grid'],l['target'],_=draw_public(full)
        if data.get('curriculum'):
            ref=json.loads((ROOT/'reference/bosova-topics.json').read_text());series=next(s for s in ref['series'] if s['id']==data['curriculum']['seriesId'])
            public['topicLabels']={t['id']:'§ '+t['number']+' · '+t['title'] for t in series['topics'] if t['kind']=='paragraph' and any(w.get('topicId')==t['id'] for w in data['worlds'])}
    public['attachments']=[]
    for index,(a,file) in enumerate(attachments):
        name=f'file-{index+1}'+file.suffix.lower();dest=output/'assets'/name;dest.parent.mkdir(exist_ok=True);shutil.copyfile(file,dest)
        public['attachments'].append({'url':'assets/'+name,'label':a['label']})
    encoded=json.dumps(public,ensure_ascii=False,allow_nan=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    page='''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITLE__ · Школа 4</title><link rel="icon" href="/portal/favicon.svg"><link rel="stylesheet" href="/portal/sections.css"><link rel="stylesheet" href="/portal/assignment.css">
<script defer src="/portal/sections.js"></script><script defer src="/portal/shared.js"></script><script defer src="/portal/assignment.js"></script></head>
<body class="s4-course"><div class="s4-toolbar"><a class="s4-brand" href="/"><span>4</span> Школьный портал</a><nav aria-label="Учебная навигация"><a href="/#catalog?grade=__GRADE__">Каталог · __GRADE__ класс</a><a href="/lessons/">Уроки</a><a href="/upload/">Сдать работу</a><a href="teacher_key.html" data-teacher hidden>Ключ учителя</a><button type="button" data-theme-toggle>◐ Тема</button></nav></div>
<main class="assignment-wrap" id="assignment"><p>Загружаем задание…</p></main><noscript>Для интерактивного задания включите JavaScript.</noscript>
<script type="application/json" id="assignmentData">__DATA__</script></body></html>'''
    if data.get('curriculum'):
        c=data['curriculum'];url='/bosova/#grade='+str(data['grade'])+'&amp;level='+('advanced' if c['seriesId'].endswith('advanced') else 'basic')+'&amp;topic='+html.escape(c['topicId'],quote=True)
        page=page.replace('<a href="/lessons/">Уроки</a>','<a href="'+url+'">Тема по Босовой</a><a href="/lessons/">Уроки</a>')
    if data['kind']=='game':
        page=page.replace('/portal/assignment.js','/portal/game.js?v=20261006').replace('/portal/assignment.css','/portal/game.css?v=20261006').replace('class="assignment-wrap" id="assignment"','class="game-wrap" id="game"').replace('<a href="teacher_key.html" data-teacher hidden>Ключ учителя</a>','<a href="teacher_key.html" data-teacher hidden>Памятка учителя</a>')
    if data.get('movedTo'):
        # Старое меню игр заменено практикумом: страница, открытая напрямую (из каталога или закладки), уходит в практикум.
        # Внутри окна практикума (iframe) и на тестовом стенде 127.0.0.1 игра работает как раньше; учитель может открыть меню с ?all=1.
        moved=data['movedTo'];require(isinstance(moved,str) and re.fullmatch(r'/courses/game-(6|7|8|9|10|11)-practicum/',moved),'movedTo: /courses/game-N-practicum/')
        page=page.replace('</head>','<script>(function(){var q=new URLSearchParams(location.search);if(window.top===window&&q.get("all")!=="1"&&location.hostname!=="127.0.0.1")location.replace("'+moved+'")})()</script></head>',1)
    if data.get('gameMode')=='typing-escape':
        engine=Path(__file__).with_name('typing_escape')
        version=hashlib.sha256((engine/'escape.js').read_bytes()+(engine/'escape.css').read_bytes()).hexdigest()[:10]
        for name in ['escape.js','escape.css']:shutil.copyfile(engine/name,output/name)
        # спрайты и шрифт сцены погони: общий набор движка тренажёра (Kenney CC0, Russo One OFL)
        (output/'assets').mkdir(exist_ok=True)
        for name in ['character_green_idle.png','character_green_walk_a.png','character_green_walk_b.png','character_green_jump.png','character_green_hit.png','big_slime_spike_walk_a.png','big_slime_spike_walk_b.png','background_color_hills.png','background_color_trees.png','background_color_mushrooms.png','background_color_desert.png','terrain_grass_block_top.png','terrain_grass_block_center.png','terrain_stone_block_top.png','terrain_stone_block_center.png','bush.png','grass.png','fence.png','rock.png','cactus.png','mushroom_red.png','mushroom_brown.png','flag_red_a.png','p_smoke.png','p_spark.png','p_star.png','p_flare.png','p_twirl.png','p_magic.png','p_light.png','p_circle.png','russo.ttf','LICENSE-kenney.txt','LICENSE-fonts-particles.txt']:shutil.copyfile(engine.parent/'trainer'/'assets'/name,output/'assets'/name)
        (output/'art').mkdir(exist_ok=True)
        for f in sorted((engine/'art').glob('*.*')):shutil.copyfile(f,output/'art'/f.name)
        page=page.replace('/portal/game.js?v=20261006','escape.js?v='+version).replace('/portal/game.css?v=20261006','escape.css?v='+version)
    if data.get('gameMode')=='crew':
        engine=Path(__file__).with_name('crew')
        art=sorted((engine/'art').glob('*.webp'))      # картинки станции: текстуры и предметы
        version=hashlib.sha256((engine/'crew.js').read_bytes()+(engine/'crew.css').read_bytes()+b''.join(f.read_bytes() for f in art)).hexdigest()[:10]
        for name in ['crew.js','crew.css']:shutil.copyfile(engine/name,output/name)
        (output/'art').mkdir(exist_ok=True)
        for f in art:shutil.copyfile(f,output/'art'/f.name)
        page=page.replace('id="assignmentData"','data-art="'+version+'" id="assignmentData"')
        page=page.replace('/portal/game.js?v=20261006','crew.js?v='+version).replace('/portal/game.css?v=20261006','crew.css?v='+version).replace('class="game-wrap" id="game"','class="game-wrap" id="crew"')
    if data.get('gameMode')=='lab':
        engine=Path(__file__).with_name('lab');games=sorted((engine/'games').glob('*.js'));art=sorted((engine/'art').glob('*.webp'))
        py=Path(__file__).with_name('codehero')/'core.js'   # интерпретатор Python из «Героя кода»: им «ОГЭ-арена» проверяет программы (задание 16)
        version=hashlib.sha256(b''.join(f.read_bytes() for f in [engine/'core.js',engine/'lab.css',py]+games+art)).hexdigest()[:10]
        shutil.copyfile(engine/'core.js',output/'core.js');shutil.copyfile(engine/'lab.css',output/'lab.css');shutil.copyfile(py,output/'pycore.js')
        (output/'games').mkdir(exist_ok=True);(output/'art').mkdir(exist_ok=True)
        for f in games:shutil.copyfile(f,output/'games'/f.name)
        for f in art:shutil.copyfile(f,output/'art'/f.name)
        tags='core.js?v=%s"></script>'%version+'<script defer src="pycore.js?v=%s"></script>'%version+''.join('<script defer src="games/%s?v=%s"></script>'%(f.name,version) for f in games)
        require(page.count('/portal/game.js?v=20261006"></script>')==1,'Шаблон страницы игры изменился');page=page.replace('/portal/game.js?v=20261006"></script>',tags)
        page=page.replace('/portal/game.css?v=20261006','lab.css?v='+version).replace('class="game-wrap" id="game"','class="game-wrap" id="lab"').replace('id="assignmentData"','data-art="'+version+'" id="assignmentData"')
    if data.get('gameMode')=='codehero':
        engine=Path(__file__).with_name('codehero');names=['core.js','levels.js','ui.js','hero.css']
        version=hashlib.sha256(b''.join((engine/n).read_bytes() for n in names)).hexdigest()[:10]
        for name in names:shutil.copyfile(engine/name,output/name)
        (output/'assets').mkdir(exist_ok=True)
        for name in ['dungeon.png','LICENSE.txt','music.ogg']:shutil.copyfile(engine/'assets'/name,output/'assets'/name)
        (output/'assets'/'art').mkdir(exist_ok=True)
        for f in sorted((engine/'assets'/'art').glob('*.webp')):shutil.copyfile(f,output/'assets'/'art'/f.name)
        page=page.replace('<script defer src="/portal/game.js?v=20261006"></script>',''.join('<script defer src="%s?v=%s"></script>'%(n,version) for n in ['core.js','levels.js','ui.js'])).replace('/portal/game.css?v=20261006','hero.css?v='+version).replace('class="game-wrap" id="game"','class="game-wrap" id="codehero"')
    if data.get('gameMode')=='practicum':
        engine=Path(__file__).with_name('practicum');pr=public['practicum']
        pr['version']=hashlib.sha256((ROOT/'godot'/pr['godotProject']/'export'/'index.pck').read_bytes()).hexdigest()[:10];pr['gameUrl']='/courses/'+pr['godotHost']+'/game/index.html'
        pr['artVersion']=hashlib.sha256(b''.join(f.read_bytes() for f in sorted((engine/'art').glob('cover_*.webp'))+sorted((engine/'art').glob('link_*.webp'))+sorted((Path(__file__).with_name('lab')/'art').glob('cover_*.webp')))).hexdigest()[:8]
        encoded=json.dumps(public,ensure_ascii=False,allow_nan=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
        names=['battle.js','battle_play.js','battle_teach.js','practicum.js','practicum.css','battle.css']
        version=hashlib.sha256(b''.join((engine/n).read_bytes() for n in names)).hexdigest()[:10]
        for name in names:shutil.copyfile(engine/name,output/name)
        (output/'art'/'bt').mkdir(parents=True,exist_ok=True)
        for f in sorted((engine/'art'/'bt').glob('*.webp')):shutil.copyfile(f,output/'art'/'bt'/f.name)
        covers=sorted((engine/'art').glob('cover_*.webp'))+sorted((engine/'art').glob('link_*.webp'))+sorted((engine/'art').glob('badge_*.webp'))+sorted((engine/'art').glob('avatar_*.webp'))+sorted((engine/'art').glob('season_*.webp'))+sorted((Path(__file__).with_name('lab')/'art').glob('cover_*.webp'))
        (output/'art').mkdir(exist_ok=True)
        for f in covers:shutil.copyfile(f,output/'art'/f.name)
        page=page.replace('<script defer src="/portal/game.js?v=20261006"></script>',''.join('<script defer src="%s?v=%s"></script>'%(n,version) for n in ['battle.js','battle_play.js','battle_teach.js','practicum.js'])).replace('/portal/game.css?v=20261006','practicum.css?v='+version+'"><link rel="stylesheet" href="battle.css?v='+version).replace('class="game-wrap" id="game"','class="game-wrap" id="practicum"')
    if data.get('gameMode')=='godot':
        export=ROOT/'godot'/data['godotProject']/'export';frame='game/index.html'
        if data.get('godotHost'):frame='/courses/'+data['godotHost']+'/game/index.html'
        else:
            (output/'game').mkdir(exist_ok=True)
            for name in GODOT_FILES:shutil.copyfile(export/name,output/'game'/name)
            for name in ['LICENSE.txt']:
                if (export.parent/'assets'/name).is_file():shutil.copyfile(export.parent/'assets'/name,output/'game'/name)
        version=hashlib.sha256((export/'index.pck').read_bytes()).hexdigest()[:10]
        page=page.replace('<script defer src="/portal/game.js?v=20261006"></script>','<style>.godot-wrap{max-width:none;margin:0;padding:8px 12px 12px}.godot-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 8px}.godot-bar h1{font-size:18px;margin:0;white-space:nowrap}.godot-bar span{flex:1;font-size:13px;opacity:.75}.godot-bar button{font:inherit;cursor:pointer;border-radius:10px;border:1px solid #41516d;background:#243149;color:#e7edf8;padding:8px 14px}.godot-wrap iframe{display:block;width:100%;height:calc(100vh - 136px);min-height:420px;border:0;border-radius:14px;background:#121829}</style>')
        page=page.replace('<main class="game-wrap" id="game"><p>Загружаем задание…</p></main><noscript>Для интерактивного задания включите JavaScript.</noscript>','<main class="game-wrap godot-wrap"><div class="godot-bar"><h1>__TITLE__</h1><span>Первая загрузка занимает до минуты. Если игра не реагирует на клавиши — щёлкните по ней мышью.</span><button type="button" id="godotFull">На весь экран</button></div><iframe id="godotFrame" src="'+frame+'?v='+version+'&amp;grade='+str(data['grade'])+('&amp;'+data['godotParams'].replace('&','&amp;') if data.get('godotParams') else '')+'" title="Игра" allow="fullscreen; autoplay" allowfullscreen></iframe></main><noscript>Для игры включите JavaScript.</noscript><script>document.getElementById("godotFull").onclick=function(){var f=document.getElementById("godotFrame");(f.requestFullscreen||f.webkitRequestFullscreen).call(f);f.focus();};</script>')
    if data['kind']=='trainer':
        engine=Path(__file__).with_name('trainer');version=hashlib.sha256((engine/'trainer.js').read_bytes()+(engine/'trainer.css').read_bytes()).hexdigest()[:10]
        for name in ['trainer.js','trainer.css']:shutil.copyfile(engine/name,output/name)
        if data.get('game'):
            # спрайты и звуки игры: набор Kenney, лицензия CC0
            (output/'assets').mkdir(exist_ok=True)
            for f in sorted((engine/'assets').iterdir()):
                if f.suffix in ('.png','.ogg','.txt','.ttf') and not f.is_symlink():shutil.copyfile(f,output/'assets'/f.name)
            (output/'art').mkdir(exist_ok=True)
            for f in sorted((engine/'art').glob('*.png'))+sorted((engine/'art').glob('*.jpg')):shutil.copyfile(f,output/'art'/f.name)
        page=page.replace('/portal/assignment.js','trainer.js?v='+version).replace('<link rel="stylesheet" href="/portal/assignment.css">','<link rel="stylesheet" href="/portal/game.css?v=20261006"><link rel="stylesheet" href="trainer.css?v='+version+'">').replace('class="assignment-wrap" id="assignment"','class="game-wrap trainer" id="trainer"')
    # Одна замена за проход: «__DATA__» в названии не должен раскрыться второй раз.
    values={'__TITLE__':html.escape(data['title']),'__GRADE__':str(data['grade']),'__DATA__':encoded}
    (output/'index.html').write_text(re.sub('__TITLE__|__GRADE__|__DATA__',lambda m:values[m.group()],page))
    notes=''.join('<li>'+html.escape(n)+'</li>' for n in data.get('teacherNotes',[]))
    for i,q in enumerate(data.get('questions',[]) if data['kind']=='test' else []):
        ans=q['answer']
        if q['type']=='single':ans=q['options'][ans]
        elif q['type']=='multi':ans='; '.join(q['options'][x] for x in ans)
        notes+='<li><strong>'+str(i+1)+'. '+html.escape(q['prompt'])+'</strong><p>'+html.escape(str(ans))+'</p><p>'+html.escape(q['explanation'])+'</p></li>'
    if data['kind']=='trainer':
        c=data.get('curriculum',{});keys=validate_trainer(data,set(c.get('topicIds',[c['topicId']] if c else [])))
        for w in data['worlds']:
            for l in w['levels']:notes+='<li><strong>'+html.escape(w['title']+' · '+l['title'])+'</strong><pre>'+html.escape(keys[l['id']])+'</pre><p>'+html.escape(l['explanation'])+'</p></li>'
    for m in data.get('missions',[]) if data['kind']=='game' else []:notes+='<li><strong>'+html.escape(m['title'])+'</strong><p>'+html.escape(m['explanation'])+'</p></li>'
    (output/'teacher_key.html').write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/portal/assignment.css">'+('<style>ol li{white-space:pre-wrap;font-family:ui-monospace,"DejaVu Sans Mono",monospace;font-size:14px;margin-bottom:14px}</style>' if data.get('gameMode')=='codehero' else '')+'<title>Ключ учителя</title><body><main class="assignment-wrap"><a href="./">← К заданию</a><h1>'+html.escape(data['title'])+' — ключ учителя</h1><ol>'+notes+'</ol></main></body></html>')
    item={'id':'course-'+data['slug'],'title':data['title'],'desc':data['description'],'url':'/courses/'+data['slug']+'/',
          'classGrade':data['grade'],'classBadge':str(data['grade'])+' класс','subject':data['subject'],'kind':'test' if data['kind']=='test' else 'practice',
          'typeLabel':'Учебная игра' if data['kind'] in ['game','trainer'] else 'Тест' if data['kind']=='test' else 'Практикум' if data['kind']=='practice' else 'План урока','teacherOnly':False,'priority':8 if data['kind'] in ['game','trainer'] else 10,
          'quickLinks':[{'text':'Ключ учителя','url':'/courses/'+data['slug']+'/teacher_key.html','teacherOnly':True}]}
    if data.get('curriculum'):item['curriculum']=data['curriculum'].copy()
    if data['kind']=='game':item['game']=True;item['quickLinks'][0]['text']='Памятка учителя';item['desc']=('Игровой практикум с отметкой · ' if data.get('gameMode')=='practicum' else 'Учебная игра · ')+item['desc']
    if data['kind']=='trainer':item['game']=True;item['desc']=('Игра-боевик с отметкой · ' if data.get('game') else 'Игровой тренажёр с отметкой · ')+item['desc']
    (output/'item.json').write_text(json.dumps(item,ensure_ascii=False,indent=2))
    return item
def atomic(path,data):
    fd,name=tempfile.mkstemp(prefix='.school4-author-',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f:f.write(data);f.flush();os.fsync(f.fileno())
        os.chmod(name,0o644);os.replace(name,path)
    finally:
        if os.path.exists(name):os.unlink(name)
def publish(data,built,item,replace=False):
    require(not data['slug'].startswith('example-'),'Образцы templates нельзя публиковать: сначала составьте реальное задание')
    require(SITE.resolve()==SITE and (SITE/'portal/catalog.json').is_file(),'Каталог сайта не найден или корень — symlink')
    lock=ROOT/'.publish.lock'
    with lock.open('a') as f:
        fcntl.flock(f,fcntl.LOCK_EX)
        courses=SITE/'courses';require(not courses.is_symlink(),'courses не должен быть symlink');courses.mkdir(exist_ok=True)
        target=courses/data['slug'];require(not target.is_symlink(),'Задание не должно быть symlink')
        require(not target.exists() or replace,'Этот slug уже существует. Для намеренного обновления требуется --replace')
        catalog_path=SITE/'portal/catalog.json';original=catalog_path.read_bytes();catalog=json.loads(original)
        require(isinstance(catalog,list) and all(isinstance(x,dict) for x in catalog),'Неверный каталог')
        collisions=[x for x in catalog if x.get('id')==item['id'] or x.get('url')==item['url']]
        require(not collisions or replace,'Карточка уже существует')
        require(all(x.get('id')==item['id'] and x.get('url')==item['url'] for x in collisions),'Коллизия ID или URL чужой карточки')
        backup=ROOT/'backups'/(datetime.now().strftime('%Y%m%d-%H%M%S-')+uuid.uuid4().hex[:8]);backup.mkdir(parents=True,mode=0o700)
        (backup/'catalog.json').write_bytes(original)
        if target.exists():shutil.copytree(target,backup/'course')
        work=Path(tempfile.mkdtemp(prefix='.school4-author-',dir=courses))
        try:
            shutil.copytree(built,work,dirs_exist_ok=True)
            for p in work.rglob('*'):p.chmod(0o755 if p.is_dir() else 0o644)
            work.chmod(0o755)
            require(catalog_path.read_bytes()==original,'Каталог изменился во время публикации. Повторите после проверки')
            old=None
            if target.exists():old=courses/('.school4-old-'+uuid.uuid4().hex);target.rename(old)
            try:
                work.rename(target)
                catalog=[x for x in catalog if x.get('id')!=item['id']];catalog.append(item)
                atomic(catalog_path,json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
            except BaseException:   # и Ctrl+C между переименованиями: старая страница возвращается на место
                if target.exists():shutil.move(str(target),str(backup/'failed-new'))
                if old is not None:old.rename(target)
                raise
        finally:
            # Неудачная попытка не оставляет в courses/ копию задания с ключом учителя.
            if work.exists():shutil.rmtree(work)
        if old is not None:shutil.move(str(old),str(backup/'previous-live'))
        (backup/'receipt.json').write_text(json.dumps({'url':item['url'],'id':item['id'],'catalogBeforeSHA256':hashlib.sha256(original).hexdigest()},indent=2))
        return backup
def number(s):
    # NaN, Infinity и 1e999 ломают JSON.parse в браузере.
    value=float(s);require(math.isfinite(value),'В JSON недопустимое число '+s);return value
def main():
    parser=argparse.ArgumentParser();parser.add_argument('file',type=Path);parser.add_argument('--publish',action='store_true');parser.add_argument('--replace',action='store_true');args=parser.parse_args()
    source=args.file.resolve();require(source.is_relative_to(ROOT/'drafts') or source.is_relative_to(ROOT/'templates'),'JSON должен находиться в drafts/ или templates/')
    require(source.stat().st_size<=512*1024,'JSON больше 512 КБ');data=json.loads(source.read_text(),parse_constant=number,parse_float=number);attachments=validate(data,source)
    output=ROOT/'build'/data['slug']
    # Build in a clean private temp; no stale attachments in a republished task.
    with tempfile.TemporaryDirectory(prefix='school4-author-build-') as tmp:
        generated=Path(tmp)/'course';item=render(data,attachments,generated)
        if output.exists():shutil.rmtree(output)
        shutil.copytree(generated,output)
        result={'validated':True,'build':str(output),'url':'http://portal.school.local'+item['url'],'published':False}
        # Публикуется проверенная личная сборка: общий build/SLUG может переписывать параллельный запуск.
        if args.publish:result.update(published=True,backup=str(publish(data,generated,item,args.replace)))
    print(json.dumps(result,ensure_ascii=False,indent=2))
def cli():
    try:main()
    except (ValueError,OSError,json.JSONDecodeError) as error:raise SystemExit('Ошибка: '+str(error))
    # Прочее — обычно поле черновика неверного типа; тип исключения подсказывает, где искать.
    except Exception as error:raise SystemExit('Ошибка: неверная структура JSON ('+type(error).__name__+': '+str(error)+')')
if __name__=='__main__':cli()
