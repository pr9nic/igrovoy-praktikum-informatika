import json,random,itertools,sys
from pathlib import Path
ROOT=Path('/home/matrix/Projects/Claude');sys.path.insert(0,str(ROOT/'tools'))
from trainer_schema import ev
PREC={'<->':0.3,'->':0.6,'or':1,'and':2,'not':3,'<':4,'>':4,'<=':4,'>=':4,'==':4,'!=':4,'+':5,'-':5,'*':6,'//':6,'/':6,'%':6,'**':7}
RU={'and':'и','or':'или','not':'не','//':'div','%':'mod','==':'=','!=':'≠','<=':'≤','>=':'≥'};LO={'and':'И','or':'ИЛИ','not':'НЕ','->':'→','<->':'≡'}
def tx(e,lang,parent=0,right=False):
    if not isinstance(e,list):return str(e)
    op=e[0];p=PREC[op];name=(RU if lang=='ru' else LO).get(op,op)
    s=name+' '+tx(e[1],lang,p) if op=='not' else tx(e[1],lang,p)+' '+name+' '+tx(e[2],lang,p,True)
    return '('+s+')' if p<parent or (p==parent and right) else s
SUB={2:'₂',8:'₈',16:'₁₆'}
def questions(world,level,rnd):
    t=world['type'];out=[]
    def add(q,a,w):
        w=[x for x in dict.fromkeys(w) if x!=a][:2]
        if w and len(q)<=190 and len(a)<=40 and all(len(x)<=40 for x in w):out.append({'q':q,'a':a,'w':w})
    if t=='calc':
        for task in level['tasks']:
            names=list(task.get('vars',{}));combos=list(itertools.product(*task.get('vars',{}).values()));rnd.shuffle(combos)
            for c in combos[:3]:
                env=dict(zip(names,c));a=round(ev(task['answer'],env));text=task['text']
                for k,v in env.items():text=text.replace('{'+k+'}',str(v))
                near=[x for x in [a*2,a//2 if a%2==0 else a+3,a+1,a-1,a*8,a//8 if a%8==0 else a+8,a*10] if x>0 and x!=a];rnd.shuffle(near);add(text,str(a),[str(x) for x in near])
    elif t=='binary':
        bits=level['bits'];base=level.get('base',16);mode=level['mode']
        for _ in range(4):
            if mode=='sum':
                x=rnd.randint(1,2**(bits-1)-1);y=rnd.randint(1,2**(bits-1)-1);v=x+y;show=lambda n:format(n,'b')+'₂';q=f"{x:b}₂ + {y:b}₂ = ?"
            else:
                v=rnd.randint(level.get('min',1),level.get('max',2**bits-1));hexs=lambda n:(format(n,'X') if base==16 else format(n,'o'))+SUB[base]
                show={'dec2bin':lambda n:format(n,'b')+'₂','bin2dec':str,'base2bin':lambda n:format(n,'b')+'₂','bin2base':hexs}[mode]
                q={'dec2bin':f"{v}₁₀ = ?₂",'bin2dec':f"{v:b}₂ = ?₁₀",'base2bin':f"{hexs(v)} = ?₂",'bin2base':f"{v:b}₂ = ?{SUB[base]}"}[mode]
            near=[x for x in [v+1,v-1,v+2,v^2,v^4,v+8] if 0<x<2**bits and x!=v];rnd.shuffle(near);add(q,show(v),[show(x) for x in near])
    elif t=='filter':
        for row in level['rows']:
            ok=bool(ev(level['cond'],dict(zip(level['fields'],row[1:]))));who=f"{level['fields'][0]} = {row[1]}" if len(level['fields'])==1 and row[0]==str(row[1]) else row[0] if row[0].startswith(level['fields'][0]+' =') else f"{row[0]} ({', '.join(f+' '+str(v) for f,v in zip(level['fields'],row[1:]))})"
            add(f"Условие: {tx(level['cond'],'ru')}. Подходит ли {who}?",'да' if ok else 'нет',['нет' if ok else 'да'])
    elif t=='truth':
        e=level['cols'][-1]
        for bits in itertools.product((0,1),repeat=len(level['vars'])):
            r=ev(e,dict(zip(level['vars'],bits)));add(f"{tx(e,'L')} при {', '.join(n+' = '+str(b) for n,b in zip(level['vars'],bits))}",str(r),[str(1-r)])
    elif t=='catch':
        for text,i in level['items']:
            others=[b for b in level['bins'] if b!=level['bins'][i]];rnd.shuffle(others);add(f"«{text}» — это…",level['bins'][i],others)
    elif t=='pairs':
        for a,b in level['pairs']:
            others=[p[1] for p in level['pairs'] if p[1]!=b];rnd.shuffle(others);add(f"Чему равно: {a}?",b,others)
    elif t=='hunt':
        for q,i in level['queries']:
            others=[str(v) for k,v in enumerate(level['a']) if k!=i];rnd.shuffle(others);add(f"a = [{', '.join(map(str,level['a']))}]. {q[0].upper()+q[1:]} — это число…",str(level['a'][i]),others)
    elif t=='snake' and not level.get('ordered') and len(level['bad'])>=2:
        rule=level['rule'].replace('ешьте только','нужны только').replace('Ешьте только','Нужны только').replace('ешьте','выберите')
        for good in level['good']:
            bad=level['bad'][:];rnd.shuffle(bad);add(f"{rule[0].upper()+rule[1:]}. Что подходит?",good,bad)
    return out
BOSSES=[('Байтожор',['slime_fire_walk_a','slime_fire_walk_b'],'aim','background_color_desert','Он плюётся огненными шарами прямо в тебя. Не стой на месте!'),
 ('Жаба-троян',['frog_idle','frog_jump'],'rain','background_color_trees','Она забрасывает арену бомбами сверху. Смотри в небо!'),
 ('Системный блок',['block_idle','block_fall'],'wave','background_color_mushrooms','Он пускает по земле пилы. Перепрыгивай их!'),
 ('Баг-пчела',['bee_a','bee_b'],'swarm','background_color_hills','Она насылает рой вирусов. Сбивай их выстрелами!')]
ORDER=['binary','calc','truth','filter','catch','pairs','hunt','snake']
for grade in range(6,12):
    src=json.loads((ROOT/f'drafts/trainer-{grade}-kodograd.json').read_text());rnd=random.Random(grade*7+1)
    quiz=sorted([w for w in src['worlds'] if w['type'] in ORDER],key=lambda w:ORDER.index(w['type']));chosen=[];seen=set()
    for w in quiz:
        if w['type'] not in seen:chosen.append(w);seen.add(w['type'])
    chosen=chosen[:4];pools=[]
    for w in chosen:
        qs=[];
        for l in w['levels']:qs+=questions(w,l,rnd)
        uniq=list({(q['q'],q['a']):q for q in qs}.values());rnd.shuffle(uniq);pools.append(uniq[:24])
    levels=[]
    for i,(w,pool) in enumerate(zip(chosen,pools)):
        name,sprite,kind,bg,trick=BOSSES[i]
        levels.append({'id':f'boss-{i+1}','title':name,'topic':w['title'],'prompt':f"Победите босса «{name}». Тема боя: {w['title'].lower()}.",'hint':w['levels'][0]['hint'],'explanation':'Победа! '+w['levels'][0]['explanation'],
          'kind':kind,'sprite':sprite,'bg':bg,'hp':6,'intro':[f"Это {name}. Он захватил район «{w['title']}».",trick],'questions':pool})
    mix=[q for pool in pools for q in pool[-6:]];rnd.shuffle(mix)
    levels.append({'id':f'boss-{len(levels)+1}','title':'Глюк','topic':'все темы сразу','prompt':'Финальный бой с Глюком: вопросы по всем темам сразу.','hint':'Вспомните, чему научили предыдущие боссы: сначала решить, потом стрелять.','explanation':'Глюк повержен! Вы применили всё, что узнали в боях с его помощниками.',
      'kind':'mix','sprite':['fly_a','fly_b'],'bg':'background_color_desert','hp':8,'intro':['Вот и сам Глюк — главный вирус Кодограда.','Он умеет всё, что умели его боссы, и задаёт вопросы по всем темам сразу.'],'questions':mix})
    topics=list(dict.fromkeys(w['topicId'] for w in chosen if 'topicId' in w)) or [src['curriculum']['topicId']]
    d=dict(schemaVersion=1,kind='trainer',game=True,slug=f'trainer-{grade}-glitch',grade=grade,subject='Информатика',title='Кодоград: битва с Глюком',
      description='Игра-боевик по информатике: бегите, прыгайте, стреляйте и побеждайте боссов вируса Глюка. Пули их не берут — щит босса пробивает только верный ответ.',durationMinutes=30,
      story=['Вирус Глюк захватил Кодоград и расставил по городу своих боссов. У каждого — щит, который не пробить обычными выстрелами.','Вы — герой с бластером. Победить босса можно только знаниями: решите его задачу и попадите в блок с верным ответом.'],
      goals=['Быстро и точно решать задачи по пройденным темам информатики.','Применять знания в условиях ограниченного времени.','Проверять решение до ответа, а не угадывать.'],
      instructions=['Управление как в Cuphead: стрелки ← → — бежать, ↑ или Z — прыжок, X — стрелять (можно держать), Shift — рывок сквозь снаряды, V — супер-удар. Чтобы стрелять вверх, держите W или зажмите C и ↑.','Нажмите F11 (или F), чтобы играть во весь экран: вопрос, арена и подсказки находятся прямо в игре.','Подойдите к двери босса и нажмите ↑. Сначала — забег по владениям босса: вирусы, ямы и двое «ворот знаний», которые открываются верным ответом. В конце забега выберите одно из трёх усилений.','За верные ответы, врагов и монеты дают биты. В мастерской Бита (в начале улицы) за них покупают постоянные улучшения.','Боссы открываются по очереди.','В бою на табло появляется вопрос, а в воздухе — блоки с ответами А, Б, В. Попадите в блок с верным ответом — босс получит урон. Неверный ответ приводит босса в ярость.','У вас три сердца. Если они закончились, бой начинается заново. Чем меньше ошибок и поражений, тем больше звёзд.','После боёв нажмите M и отправьте отметку в журнал.'],
      teacherNotes=['Это отдельная игра-боевик в духе Cuphead: бои с боссами, стрельба, уклонение. Обычные выстрелы сбивают снаряды и мелких вирусов, но босса ранит только попадание в блок с верным ответом.',
       'Перед каждым боссом — забег с врагами и двумя «воротами знаний»; уровень забега каждый раз собирается заново из случайных участков. Пройденный забег повторно проходить не нужно. Ошибки у ворот тоже снижают звёзды.',
       'Биты, покупки в мастерской и пройденные забеги хранятся в браузере компьютера (на сервер уходят только звёзды за боссов). На другом компьютере ученик сохранит звёзды, но улучшения придётся заработать заново.',
       'Одна отметка за всю игру: за каждого босса от ★ до ★★★ (без ошибок и поражений — три звезды; до двух ошибок — две). «5» — от 80 % звёзд, «4» — от 60 %, «3» — от 33 %.',
       'Вопросы боссов составлены автоматически из заданий тренажёра «Кодоград» того же класса, поэтому темы совпадают; ответы вычислены программой. Полный список вопросов с ответами — ниже в этом ключе.',
       'Бой с одним боссом занимает 3–6 минут. Вся игра — около 30 минут.','Игра рассчитана на клавиатуру и экран компьютера: F11 разворачивает её во весь экран. Звук включается кнопкой «Звук» вверху (до перехода в полноэкранный режим).',
       'Графика и звуки — свободный набор Kenney New Platformer Pack (лицензия CC0), файл лицензии лежит в папке assets.','Это учебная игра, а не защищённая контрольная: ответы проверяются в браузере.'],
      grading={'three':33,'four':60,'five':80},curriculum={**src['curriculum'],'topicId':topics[0],'topicIds':topics},
      worlds=[{'id':'boss','type':'boss','title':'Боссы Глюка','description':'Победите всех боссов по очереди. Щит каждого пробивает только верный ответ на его вопрос.','levels':levels}])
    d['movedTo']=f'/courses/game-{grade}-practicum/'  # открывается только из практикума
    (ROOT/f'drafts/trainer-{grade}-glitch.json').write_text(json.dumps(d,ensure_ascii=False,indent=1)+'\n');print(grade,[(l['title'],l['topic'],len(l['questions'])) for l in levels])
