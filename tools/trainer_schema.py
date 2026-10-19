"""Validate game trainers (kind=trainer) and prove every level is solvable.

The simulators mirror tools/trainer/trainer.js; reference solutions stay in the teacher key.
"""
import heapq,itertools,math,re
TYPES={'robot','trace','binary','logic','pixel','graph','calc','draw','filter','sort','cipher','truth','array','sheet','path','catch','pairs','hunt','snake','boss'}
ABC='АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
BLOCKS={'forward','left','right','repeat','while','if'}
CONDS={'free','wall','left','right','notgoal'}
GATES={'and':(2,lambda a,b:a&b),'or':(2,lambda a,b:a|b),'xor':(2,lambda a,b:a^b),'nand':(2,lambda a,b:1-(a&b)),
       'nor':(2,lambda a,b:1-(a|b)),'not':(1,lambda a:1-a),'buf':(1,lambda a:a)}
GATE_RU={'and':'И','or':'ИЛИ','xor':'ИСКЛ. ИЛИ','nand':'И-НЕ','nor':'ИЛИ-НЕ','not':'НЕ','buf':'провод'}
BLOCK_RU={'forward':'вперёд','left':'налево','right':'направо'}
COND_RU={'free':'впереди свободно','wall':'впереди стена','left':'слева свободно','right':'справа свободно','notgoal':'не на финише'}
OPS={'+','-','*','/','//','%','**','<','>','<=','>=','==','!=','and','or','not','->','<->','at','len'}
def need(ok,msg):
    if not ok:raise ValueError('Тренажёр: '+msg)
def string(x,label,limit=1500):need(isinstance(x,str) and 0<len(x.strip())<=limit,label+' — обязательный текст')
def integer(x,lo,hi,label):need(type(x) is int and lo<=x<=hi,f'{label}: целое {lo}–{hi}')

def ev(e,env):
    if type(e) in (int,float):return e
    if isinstance(e,str):
        need(e in env,'переменная '+e+' используется до присваивания');return env[e]
    need(isinstance(e,list) and e and e[0] in OPS and len(e)==(2 if e[0] in ('not','len') else 3),'неверное выражение '+repr(e))
    op=e[0]
    if op in ('at','len'):
        need(isinstance(env.get(e[1]),list),'нет массива '+repr(e[1]))
        if op=='len':return len(env[e[1]])
        i=ev(e[2],env);need(type(i) is int and 0<=i<len(env[e[1]]),'индекс вне массива');return env[e[1]][i]
    x=ev(e[1],env)
    if op=='->':return 1 if (not x) or ev(e[2],env) else 0
    if op=='<->':return 1 if bool(x)==bool(ev(e[2],env)) else 0
    if op=='not':return 0 if x else 1
    if op=='and':return 1 if x and ev(e[2],env) else 0
    if op=='or':return 1 if x or ev(e[2],env) else 0
    y=ev(e[2],env)
    if op in ('/','//','%'):need(y!=0,'деление на ноль')
    return {'+':lambda:x+y,'-':lambda:x-y,'*':lambda:x*y,'/':lambda:x/y,'//':lambda:x//y,'%':lambda:x%y,'**':lambda:x**y,
            '<':lambda:int(x<y),'>':lambda:int(x>y),'<=':lambda:int(x<=y),'>=':lambda:int(x>=y),'==':lambda:int(x==y),'!=':lambda:int(x!=y)}[op]()

LAST_EDGES=set()
def count_blocks(program):
    return sum(1+count_blocks(n.get('body',[]))+count_blocks(n.get('then',[]))+count_blocks(n.get('else',[])) for n in program)
def check_program(program,blocks,conds):
    need(isinstance(program,list),'программа — список блоков')
    for n in program:
        need(isinstance(n,dict) and n.get('op') in blocks,'в решении блок, которого нет в палитре уровня')
        if n['op']=='repeat':integer(n.get('n'),2,12,'repeat.n');check_program(n.get('body'),blocks,conds)
        elif n['op']=='while':need(n.get('cond') in conds,'условие вне списка уровня');check_program(n.get('body'),blocks,conds)
        elif n['op']=='if':need(n.get('cond') in conds,'условие вне списка уровня');check_program(n.get('then'),blocks,conds);check_program(n.get('else',[]),blocks,conds)
def robot_run(level,program):
    rows=level['grid'];w,h=len(rows[0]),len(rows);cr=set()
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c=='S':sx,sy=x,y
            elif c=='*':cr.add((x,y))
    gx=gy=-1 if 'G' not in ''.join(rows) else None
    if gx is None:gx,gy=next((x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c=='G')
    state={'x':sx,'y':sy,'d':'NESW'.index(level.get('dir','E')),'steps':0,'status':''};got=set();edges=LAST_EDGES;edges.clear()
    D=[(0,-1),(1,0),(0,1),(-1,0)]
    def free(turn):
        dx,dy=D[(state['d']+turn)%4];x,y=state['x']+dx,state['y']+dy
        return 0<=x<w and 0<=y<h and rows[y][x]!='#'
    def test(c):
        return free(0) if c=='free' else not free(0) if c=='wall' else free(3) if c=='left' else free(1) if c=='right' else (state['x'],state['y'])!=(gx,gy)
    def run(items):
        for n in items:
            if state['status']:return
            state['steps']+=1
            if state['steps']>300:state['status']='limit';return
            op=n['op']
            if op=='forward':
                if not free(0):state['status']='crash';return
                dx,dy=D[state['d']];a=f"{state['x']},{state['y']}";state['x']+=dx;state['y']+=dy;edges.add('-'.join(sorted([a,f"{state['x']},{state['y']}"])))
                if (state['x'],state['y']) in cr:got.add((state['x'],state['y']))
            elif op=='left':state['d']=(state['d']+3)%4
            elif op=='right':state['d']=(state['d']+1)%4
            elif op=='repeat':
                for _ in range(n['n']):
                    if state['status']:break
                    run(n['body'])
            elif op=='while':
                while not state['status'] and test(n['cond']):
                    state['steps']+=1
                    if state['steps']>300:state['status']='limit';return
                    run(n['body'])
            elif op=='if':run(n['then'] if test(n['cond']) else n.get('else',[]))
    run(program)
    if not state['status']:state['status']='nogoal' if (state['x'],state['y'])!=(gx,gy) else 'crystals' if got!=cr else 'win'
    return state['status']
def program_text(program,depth=0):
    out=[]
    for n in program:
        pad='    '*depth;op=n['op']
        if op=='repeat':out+=[f"{pad}повтори {n['n']}:"]+program_text(n['body'],depth+1)
        elif op=='while':out+=[f"{pad}пока {COND_RU[n['cond']]}:"]+program_text(n['body'],depth+1)
        elif op=='if':
            out+=[f"{pad}если {COND_RU[n['cond']]}:"]+program_text(n['then'],depth+1)
            if n.get('else'):out+=[pad+'иначе:']+program_text(n['else'],depth+1)
        else:out.append(pad+BLOCK_RU[op])
    return out

def trace_moves(level):return run_program(level)[0]
def run_program(level):
    env={k:(list(v) if isinstance(v,list) else v) for k,v in level.get('init',{}).items()};moves=[];guard=[0];funcs=level.get('funcs',{})
    def run(items,stack):
        need(isinstance(items,list),'тело программы — список')
        for s in items:
            guard[0]+=1;need(guard[0]<=3000,'программа слишком длинная или цикл не заканчивается')
            need(isinstance(s,dict),'команда должна быть объектом');op=s.get('op')
            if op=='move':need(s.get('d') in ('R','L','U','D'),'move.d: R/L/U/D');moves.append(s['d'])
            elif op=='repeat':
                integer(s.get('n'),2,12,'repeat.n')
                for _ in range(s['n']):run(s['body'],stack)
            elif op=='for':
                need(isinstance(s.get('var'),str) and type(s.get('from')) is int and type(s.get('to')) is int and s['from']<s['to'],'for: var, from < to')
                for i in range(s['from'],s['to']):env[s['var']]=i;run(s['body'],stack)
            elif op=='set':need(isinstance(s.get('var'),str),'set.var');env[s['var']]=ev(s['expr'],env)
            elif op=='seta':
                need(isinstance(env.get(s.get('arr')),list),'seta: нет массива');i=ev(s['idx'],env);need(type(i) is int and 0<=i<len(env[s['arr']]),'seta: индекс вне массива');env[s['arr']][i]=ev(s['expr'],env)
            elif op=='if':run(s['then'] if ev(s['cond'],env) else s.get('else',[]),stack)
            elif op=='while':
                while ev(s['cond'],env):
                    guard[0]+=1;need(guard[0]<=3000,'цикл не заканчивается');run(s['body'],stack)
            elif op=='call':
                need(s.get('name') in funcs and s['name'] not in stack,'call: неизвестный или рекурсивный алгоритм');run(funcs[s['name']],stack+[s['name']])
            else:need(False,'неизвестная команда '+repr(op))
    run(level['program'],[])
    return moves,env

def draw_public(level):
    """Grid and target lines of a drawing level, derived from its solution."""
    grid=['.'*level['w'] for _ in range(level['h'])];x,y=level['start'];grid[y]=grid[y][:x]+'S'+grid[y][x+1:]
    status=robot_run({**level,'grid':grid},level['solution'])
    return grid,sorted(LAST_EDGES),status
def validate_level(level,world,key):
    typ=world['type']
    if typ=='draw':
        integer(level.get('w'),3,9,'w');integer(level.get('h'),3,9,'h');start=level.get('start')
        need(isinstance(start,list) and len(start)==2 and all(type(v) is int for v in start) and 0<=start[0]<level['w'] and 0<=start[1]<level['h'],'start вне поля')
        need(level.get('dir','E') in ('N','E','S','W'),'dir');blocks=level.get('blocks');need(isinstance(blocks,list) and blocks and set(blocks)<={'forward','left','right','repeat'},'blocks рисования: forward/left/right/repeat')
        integer(level.get('par'),1,30,'par');integer(level.get('max'),level['par'],30,'max');sol=level.get('solution');check_program(sol,set(blocks),set())
        need(count_blocks(sol)<=level['par'],level['id']+': решение длиннее par');grid,target,status=draw_public(level)
        need(status=='nogoal' and len(target)>=3,f"{level['id']}: решение выходит за поле или рисунок слишком мал ({status})")
        key.append('\n'.join(program_text(sol))+f"\n({count_blocks(sol)} блоков)");return
    if typ=='filter':
        fields=level.get('fields');need(isinstance(fields,list) and 1<=len(fields)<=4 and all(isinstance(f,str) and re.fullmatch(r'[a-zа-яё_]+',f) for f in fields),'fields: 1–4 имени строчными буквами')
        rows=level.get('rows');need(isinstance(rows,list) and 4<=len(rows)<=10 and all(isinstance(r,list) and len(r)==len(fields)+1 and isinstance(r[0],str) and r[0] and all(type(v) is int for v in r[1:]) for r in rows),'rows: [подпись, числа…], 4–10 строк')
        if 'nameLabel' in level:string(level['nameLabel'],'nameLabel',30)
        hit=[r[0] for r in rows if ev(level.get('cond'),dict(zip(fields,r[1:])))];need(0<len(hit)<len(rows),level['id']+': условию должны удовлетворять не все и не ноль строк')
        key.append('; '.join(hit));return
    if typ=='sort':
        v=level.get('values');need(isinstance(v,list) and 4<=len(v)<=8 and all(type(n) is int and 0<n<100 for n in v) and len(set(v))==len(v),'values: 4–8 разных чисел 1–99')
        desc=level.get('order','asc')=='desc';need(level.get('order','asc') in ('asc','desc'),'order: asc/desc')
        inv=sum(1 for i in range(len(v)) for j in range(i+1,len(v)) if (v[j]>v[i] if desc else v[j]<v[i]));need(inv>=2,'ряд уже почти упорядочен')
        key.append(f'Минимум обменов соседних элементов: {inv}');return
    if typ=='truth':
        vs=level.get('vars');need(isinstance(vs,list) and 2<=len(vs)<=3 and all(re.fullmatch(r'[A-Z]',v or '') for v in vs) and len(set(vs))==len(vs),'vars: 2–3 латинские буквы')
        cols=level.get('cols');need(isinstance(cols,list) and 1<=len(cols)<=4,'cols: 1–4 столбца');rows=[]
        for bits in itertools.product((0,1),repeat=len(vs)):rows.append([ev(c,dict(zip(vs,bits))) for c in cols])
        need(all(v in (0,1) for r in rows for v in r) and len({r[-1] for r in rows})==2,level['id']+': итоговый столбец должен содержать и 0, и 1')
        key.append('\n'.join(' '.join(map(str,bits))+' | '+' '.join(map(str,r)) for bits,r in zip(itertools.product((0,1),repeat=len(vs)),rows)));return
    if typ=='array':
        init=level.get('init');need(isinstance(init,dict) and init and all(re.fullmatch(r'[a-z]',k) and (type(v) is int or (isinstance(v,list) and 2<=len(v)<=8 and all(type(n) is int for n in v))) for k,v in init.items()),'init: массивы и числа с именами из одной буквы')
        moves,env=run_program(level);need(not moves,'в программе с массивом не должно быть команд движения')
        ans=env.get(level.get('ask'));need(type(ans) is int or (isinstance(ans,list) and all(type(n) is int for n in ans)),level['id']+': ask — имя переменной или массива с целыми значениями')
        need(ans!=init.get(level['ask']),level['id']+': ответ совпадает с исходными данными');key.append(f"{level['ask']} = {ans}");return
    if typ=='sheet':
        cols=level.get('cols');need(isinstance(cols,list) and 2<=len(cols)<=6 and cols==list('ABCDEF')[:len(cols)],'cols: A, B, … подряд');integer(level.get('rows'),2,8,'rows')
        cells=level.get('cells');need(isinstance(cells,dict) and cells,'cells');val={};ok=lambda k:isinstance(k,str) and re.fullmatch(r'\$?[A-F]\$?[1-8]',k) and k.replace('$','')[0] in cols and int(k.replace('$','')[1])<=level['rows']
        for k,c in cells.items():
            need(ok(k) and '$' not in k,'адрес ячейки '+repr(k));need(type(c) in (int,float) or (isinstance(c,dict) and (isinstance(c.get('t'),str) or 'f' in c)),'ячейка: число, {t: текст} или {f: формула}')
            if type(c) in (int,float):val[k]=c
        FN={'sum':sum,'avg':lambda x:sum(x)/len(x),'min':min,'max':max,'count':len}
        class Wait(Exception):pass
        def calc(e):
            if type(e) in (int,float):return e
            if isinstance(e,str):
                need(ok(e),'ссылка '+repr(e));k=e.replace('$','');need(k in cells and not isinstance(cells[k],dict) or 'f' in cells.get(k,{}),'ссылка на пустую или текстовую ячейку '+e)
                if k not in val:raise Wait()
                return val[k]
            need(isinstance(e,list) and e,'формула');op=e[0]
            if op in FN:
                need(len(e)==3 and ok(e[1]) and ok(e[2]),'диапазон');a,b=e[1].replace('$',''),e[2].replace('$','');xs=[]
                for col in range(ord(a[0]),ord(b[0])+1):
                    for row in range(int(a[1]),int(b[1])+1):
                        k=chr(col)+str(row)
                        if k not in cells or (isinstance(cells[k],dict) and 't' in cells[k]):continue
                        if k not in val:raise Wait()
                        xs.append(val[k])
                need(xs,'пустой диапазон');return FN[op](xs)
            if op=='if':need(len(e)==4,'ЕСЛИ: три аргумента');return calc(e[2]) if calc(e[1]) else calc(e[3])
            need(op in ('+','-','*','/','<','>','<=','>=','==','!=') and len(e)==3,'операция формулы '+repr(op));return ev([op,calc(e[1]),calc(e[2])],{})
        formulas=[k for k,c in cells.items() if isinstance(c,dict) and 'f' in c];need(1<=len(formulas)<=8,'формул: 1–8')
        for _ in range(12):
            for k in formulas:
                if k not in val:
                    try:val[k]=calc(cells[k]['f'])
                    except Wait:pass
        need(all(k in val for k in formulas),level['id']+': циклическая ссылка в формулах')
        need(all(abs(val[k]*100-round(val[k]*100))<1e-6 for k in formulas),level['id']+': значение формулы должно иметь не больше двух знаков после запятой')
        key.append('; '.join(f"{k} = {round(val[k],2):g}" for k in sorted(formulas)));return
    if typ=='path':
        names=[]
        def walk(node,trail):
            need(isinstance(node,dict) and isinstance(node.get('name'),str) and re.fullmatch(r'[^\\/]{1,30}',node['name']),'имя узла дерева');here=trail+[node['name']];names.append(here)
            if 'children' in node:
                need(isinstance(node['children'],list) and len({c.get('name') for c in node['children'] if isinstance(c,dict)})==len(node['children']),'одинаковые имена в одной папке')
                for c in node['children']:walk(c,here)
        walk(level.get('tree'),[]);need(4<=len(names)<=30,'дерево: 4–30 объектов');need(level.get('ask') in ('click','type'),'ask: click/type')
        need(level.get('target') in names and len(level['target'])>=2,level['id']+': target должен быть объектом дерева')
        if 'start' in level:need(level['start'] in names and level['start']!=level['target'] and level['ask']=='click','start — папка дерева, только для ask=click')
        key.append('\\'.join(level['target']));return
    if typ=='catch':
        bins=level.get('bins');need(isinstance(bins,list) and 2<=len(bins)<=4 and all(isinstance(b,str) and 0<len(b)<=40 for b in bins) and len(set(bins))==len(bins),'bins: 2–4 разных названия')
        items=level.get('items');need(isinstance(items,list) and 6<=len(items)<=16 and all(isinstance(i,list) and len(i)==2 and isinstance(i[0],str) and 0<len(i[0])<=60 and type(i[1]) is int and 0<=i[1]<len(bins) for i in items),'items: 6–16 пар [текст, номер корзины]')
        need(len({i[0] for i in items})==len(items) and {i[1] for i in items}==set(range(len(bins))),level['id']+': предметы не повторяются, в каждой корзине есть хотя бы один')
        key.append('\n'.join(b+': '+', '.join(i[0] for i in items if i[1]==n) for n,b in enumerate(bins)));return
    if typ=='pairs':
        pairs=level.get('pairs');need(isinstance(pairs,list) and 4<=len(pairs)<=8 and all(isinstance(p,list) and len(p)==2 and all(isinstance(x,str) and 0<len(x)<=40 for x in p) for p in pairs),'pairs: 4–8 пар строк')
        flat=[x for p in pairs for x in p];need(len(set(flat))==len(flat),level['id']+': тексты карточек не должны повторяться')
        key.append('\n'.join(a+' ↔ '+b for a,b in pairs));return
    if typ=='snake':
        string(level.get('rule'),'rule',120);good=level.get('good');bad=level.get('bad',[])
        need(isinstance(good,list) and 3<=len(good)<=8 and isinstance(bad,list) and len(bad)<=8 and all(isinstance(x,str) and 0<len(x)<=14 for x in good+bad),'good: 3–8, bad: до 8 карточек не длиннее 14 символов')
        need(len(set(good+bad))==len(good+bad),level['id']+': карточки не должны повторяться');need(type(level.get('ordered',False)) is bool and (bad or level.get('ordered')),'нужны лишние карточки bad или ordered=true')
        key.append(('По порядку: ' if level.get('ordered') else 'Съедобные: ')+', '.join(good)+('\nЛишние: '+', '.join(bad) if bad else ''));return
    if typ=='boss':
        for k in ('topic',):string(level.get(k),k,90)
        need(level.get('kind') in ('aim','rain','wave','swarm','mix'),'boss.kind: aim/rain/wave/swarm/mix');integer(level.get('hp',6),4,10,'hp')
        sprites={'bee_a','bee_b','fly_a','fly_b','frog_idle','frog_jump','block_idle','block_fall','slime_fire_walk_a','slime_fire_walk_b','slime_spike_walk_a','slime_spike_walk_b','worm_ring_move_a','worm_ring_move_b'}
        need(isinstance(level.get('sprite'),list) and len(level['sprite'])==2 and set(level['sprite'])<=sprites,'boss.sprite: два кадра из набора')
        need(level.get('bg') in ('background_color_hills','background_color_trees','background_color_desert','background_color_mushrooms'),'boss.bg')
        intro=level.get('intro');need(isinstance(intro,list) and 1<=len(intro)<=3,'intro: 1–3 реплики')
        for line in intro:string(line,'intro',260)
        for field in ['questions', 'standardQuestions']:
            if field == 'standardQuestions' and field not in level:continue
            qs=level.get(field);need(isinstance(qs,list) and level.get('hp',6)<=len(qs)<=60,field+': не меньше hp и не больше 60')
            for q in qs:
                need(isinstance(q,dict) and isinstance(q.get('q'),str) and 0<len(q['q'])<=190 and isinstance(q.get('a'),str) and 0<len(q['a'])<=40,'вопрос: q и a')
                w=q.get('w');need(isinstance(w,list) and 1<=len(w)<=2 and all(isinstance(x,str) and 0<len(x)<=40 for x in w) and len(set(w+[q['a']]))==len(w)+1,level['id']+': неверные варианты w у вопроса '+q['q'][:40])
                if 'explanation' in q:string(q['explanation'],'question.explanation',240)
            need(len({(q['q'],q['a']) for q in qs})==len(qs),level['id']+': вопросы повторяются')
            key.append(field+'\n'+'\n'.join(q['q']+' → '+q['a']+(' · '+q['explanation'] if 'explanation' in q else '') for q in qs))
        return
    if typ=='hunt':
        a=level.get('a');need(isinstance(a,list) and 4<=len(a)<=8 and all(type(v) is int for v in a) and len(set(a))==len(a),'a: 4–8 разных целых')
        qs=level.get('queries');need(isinstance(qs,list) and 5<=len(qs)<=12 and all(isinstance(q,list) and len(q)==2 and isinstance(q[0],str) and 0<len(q[0])<=160 and type(q[1]) is int and 0<=q[1]<len(a) for q in qs),'queries: 5–12 пар [задание, индекс]')
        key.append('a = '+str(a)+'\n'+'\n'.join(f'{q[0]} → индекс {q[1]} (значение {a[q[1]]})' for q in qs));return
    if typ=='cipher':
        need(level.get('mode') in ('decode','encode','crack'),'mode: decode/encode/crack');integer(level.get('shift'),1,31,'shift')
        w=level.get('word');need(isinstance(w,str) and 3<=len(w)<=12 and all(c in ABC for c in w),'word: 3–12 заглавных русских букв без Ё')
        enc=''.join(ABC[(ABC.index(c)+level['shift'])%32] for c in w);key.append(f"{w} ↔ {enc} (сдвиг {level['shift']})");return
    if typ=='robot':
        rows=level.get('grid');need(isinstance(rows,list) and 2<=len(rows)<=9 and all(isinstance(r,str) for r in rows),'grid: 2–9 строк')
        need(2<=len(rows[0])<=10 and all(len(r)==len(rows[0]) and set(r)<=set('#.SG*') for r in rows),'grid: прямоугольник из # . S G *, ширина 2–10')
        flat=''.join(rows);need(flat.count('S')==1 and flat.count('G')==1,'нужны ровно один S и один G')
        need(level.get('dir','E') in 'NESW' and len(level.get('dir','E'))==1,'dir: N/E/S/W')
        blocks=level.get('blocks');need(isinstance(blocks,list) and blocks and set(blocks)<=BLOCKS and len(set(blocks))==len(blocks),'blocks: команды палитры')
        conds=level.get('conds',['free','wall','notgoal']);need(isinstance(conds,list) and conds and set(conds)<=CONDS,'conds: условия')
        integer(level.get('par'),1,30,'par');integer(level.get('max'),level['par'],30,'max')
        sol=level.get('solution');check_program(sol,set(blocks),set(conds))
        need(count_blocks(sol)<=level['par'],f"{level['id']}: решение длиннее par ({count_blocks(sol)} > {level['par']})")
        status=robot_run(level,sol);need(status=='win',f"{level['id']}: эталонное решение не проходит уровень ({status})")
        key.append('\n'.join(program_text(sol))+f"\n({count_blocks(sol)} блоков)")
    elif typ=='trace':
        integer(level.get('w'),2,10,'w');integer(level.get('h'),2,10,'h')
        start=level.get('start');need(isinstance(start,list) and len(start)==2 and all(type(v) is int for v in start),'start: [x, y]')
        for name,body in level.get('funcs',{}).items():need(re.fullmatch(r'[a-zа-яё_]+',name) is not None,'имя алгоритма — строчные буквы')
        moves=trace_moves(level);need(3<=len(moves)<=60,f"{level['id']}: нужно 3–60 ходов, получилось {len(moves)}")
        x,y=start;need(0<=x<level['w'] and 0<=y<level['h'],'start вне поля')
        for m in moves:
            x+={'R':1,'L':-1}.get(m,0);y+={'D':1,'U':-1}.get(m,0)
            need(0<=x<level['w'] and 0<=y<level['h'],f"{level['id']}: исполнитель выходит за поле")
        key.append(' '.join({'R':'→','L':'←','U':'↑','D':'↓'}[m] for m in moves))
    elif typ=='binary':
        mode=level.get('mode');need(mode in ('dec2bin','bin2dec','base2bin','bin2base','sum'),'mode двоичного пульта')
        integer(level.get('bits'),3,8,'bits');integer(level.get('count'),3,12,'count')
        if mode=='sum':need(level['bits']>=4,'sum: bits ≥ 4')
        else:
            lo,hi=level.get('min',1),level.get('max',2**level['bits']-1)
            need(type(lo) is int and type(hi) is int and 0<=lo and hi<2**level['bits'] and hi-lo>=3,'min/max вне разрядности или диапазон слишком мал')
        if mode in ('base2bin','bin2base'):
            need(level.get('base',16) in (8,16) and level['bits']%(3 if level.get('base',16)==8 else 4)==0,'base 8/16 и bits кратно 3/4')
        key.append('Числа выбираются случайно; ответ вычисляет программа.')
    elif typ=='calc':
        integer(level.get('count'),3,12,'count');tasks=level.get('tasks');need(isinstance(tasks,list) and 1<=len(tasks)<=10,'tasks: 1–10 шаблонов')
        lines=[]
        for t in tasks:
            string(t.get('text'),'calc.text');vars_=t.get('vars',{})
            need(isinstance(vars_,dict) and all(isinstance(v,list) and v and all(type(n) is int for n in v) for v in vars_.values()),'vars: списки целых')
            need(set(re.findall(r'\{(\w+)\}',t['text']))<=set(vars_),'в тексте есть {переменная} без значений')
            if 'unit' in t:string(t['unit'],'unit',80)
            if 'tip' in t:string(t['tip'],'tip',300)
            combos=list(itertools.product(*vars_.values()));need(len(combos)<=5000,'слишком много сочетаний значений')
            need(len(tasks)>1 or len(combos)>=4,'слишком мало разных заданий в серии')
            for c in combos:
                v=ev(t['answer'],dict(zip(vars_,c)));need(math.isfinite(v) and abs(v-round(v))<1e-9 and 0<=v<10**9,f"{level['id']}: ответ не целый или вне диапазона при {dict(zip(vars_,c))}")
            c=combos[0];text=t['text']
            for k,v in zip(vars_,c):text=text.replace('{'+k+'}',str(v))
            lines.append(f"{text} → {round(ev(t['answer'],dict(zip(vars_,c))))}")
        key.append('Пример каждого шаблона:\n'+'\n'.join(lines))
    elif typ=='logic':
        inputs=level.get('inputs');need(isinstance(inputs,list) and 2<=len(inputs)<=3 and len(set(inputs))==len(inputs) and all(re.fullmatch(r'[A-Z]',i or '') for i in inputs),'inputs: 2–3 латинские буквы')
        nodes=level.get('nodes');need(isinstance(nodes,list) and 1<=len(nodes)<=6,'nodes: 1–6 элементов');known=list(inputs);slots=[]
        g1=level.get('gates1',['buf','not']);g2=level.get('gates2',['and','or'])
        need(all(GATES.get(g,(0,))[0]==1 for g in g1) and all(GATES.get(g,(0,))[0]==2 for g in g2) and g1 and g2,'gates1/gates2: элементы нужной арности')
        for n in nodes:
            need(isinstance(n,dict) and isinstance(n.get('id'),str) and re.fullmatch(r'[a-z][a-z0-9]*',n['id']) and n['id'] not in known,'node.id: уникальные строчные')
            need(isinstance(n.get('in'),list) and len(n['in']) in (1,2) and all(i in known for i in n['in']),'node.in: 1–2 уже объявленных источника')
            if 'gate' in n:need(GATES.get(n['gate'],(0,))[0]==len(n['in']),'gate не подходит по числу входов')
            else:slots.append(n)
            if 'row' in n:need(type(n['row']) in (int,float) and 0<=n['row']<=5,'row: 0–5')
            known.append(n['id'])
        need(level.get('out')==nodes[-1]['id'],'out — последний элемент схемы');need(slots,'в схеме нет окошек для выбора')
        target=level.get('target');need(isinstance(target,list) and len(target)==2**len(inputs) and all(t in (0,1) and type(t) is int for t in target),'target: 0/1 для всех наборов входов')
        def output(choice,vals):
            vals=dict(vals)
            for n in nodes:vals[n['id']]=GATES[n.get('gate') or choice[n['id']]][1](*[vals[i] for i in n['in']])
            return vals[level['out']]
        combos=[dict(zip(inputs,bits)) for bits in itertools.product((0,1),repeat=len(inputs))];found=[]
        for pick in itertools.product(*[(g1 if len(n['in'])==1 else g2) for n in slots]):
            choice={n['id']:g for n,g in zip(slots,pick)}
            if [output(choice,c) for c in combos]==target:found.append(choice)
        need(found,f"{level['id']}: схему нельзя собрать из разрешённых элементов");need(len(found)<len(list(itertools.product(*[(g1 if len(n['in'])==1 else g2) for n in slots]))),'подходит любой выбор — уровень бессмысленный')
        key.append('; '.join(f"{k} = {GATE_RU[v]}" for k,v in found[0].items())+(f" (всего подходящих вариантов: {len(found)})" if len(found)>1 else ''))
    elif typ=='pixel':
        rows=level.get('rows');need(isinstance(rows,list) and 3<=len(rows)<=10 and all(isinstance(r,str) for r in rows),'rows: 3–10 строк')
        need(3<=len(rows[0])<=8 and all(len(r)==len(rows[0]) and set(r)<={'0','1'} for r in rows),'rows: прямоугольник 0/1 шириной 3–8')
        need(level.get('show','bin') in ('bin','hex','dec') and (level.get('show')!='hex' or len(rows[0])%4==0),'show: bin/hex/dec; для hex ширина кратна 4')
        need(any('1' in r for r in rows),'пустой рисунок');key.append('\n'.join(r.replace('1','█').replace('0','·') for r in rows))
    elif typ=='graph':
        nodes=level.get('nodes');need(isinstance(nodes,list) and 3<=len(nodes)<=12,'nodes: 3–12 вершин');ids=[]
        for n in nodes:
            need(isinstance(n,dict) and isinstance(n.get('id'),str) and re.fullmatch(r'[A-Za-zА-Яа-яЁё0-9]{1,3}',n['id']) and n['id'] not in ids,'node.id: 1–3 символа, уникальный');ids.append(n['id'])
            need(all(type(n.get(k)) in (int,float) and 5<=n[k]<=95 for k in 'xy'),'координаты вершины 5–95')
            if 'label' in n:string(n['label'],'label',14)
        edges=level.get('edges');need(isinstance(edges,list) and edges,'edges');seen=set();adj={i:[] for i in ids}
        for e in edges:
            need(isinstance(e,list) and len(e)==3 and e[0] in ids and e[1] in ids and e[0]!=e[1] and type(e[2]) is int and 1<=e[2]<=999,'ребро: [a, b, длина]')
            pair=frozenset(e[:2]);need(pair not in seen,'повтор ребра');seen.add(pair);adj[e[0]].append((e[1],e[2]));adj[e[1]].append((e[0],e[2]))
        need(level.get('from') in ids and level.get('to') in ids and level['from']!=level['to'],'from/to')
        if 'unit' in level:string(level['unit'],'unit',20)
        dist={level['from']:0};prev={};heap=[(0,level['from'])]
        while heap:
            d,u=heapq.heappop(heap)
            if d>dist[u]:continue
            for v,w in adj[u]:
                if d+w<dist.get(v,math.inf):dist[v]=d+w;prev[v]=u;heapq.heappush(heap,(d+w,v))
        need(level['to'] in dist,f"{level['id']}: до цели нет пути");path=[level['to']]
        while path[-1]!=level['from']:path.append(prev[path[-1]])
        key.append(' → '.join(reversed(path))+f" (длина {dist[level['to']]})")

def validate_trainer(data,topics):
    """Returns {level id: teacher key text}."""
    story=data.get('story');need(isinstance(story,list) and 1<=len(story)<=5,'story: 1–5 абзацев')
    for s in story:string(s,'story')
    scale=data.get('grading');need(isinstance(scale,dict) and all(type(scale.get(k)) in (int,float) for k in ('three','four','five')) and 0<scale['three']<scale['four']<scale['five']<=100,'grading: пороги three < four < five')
    letters=data.get('classLetters',['А','Б']);need(isinstance(letters,list) and 1<=len(letters)<=8 and all(isinstance(l,str) and 1<=len(l)<=3 for l in letters),'classLetters: 1–8 букв')
    worlds=data.get('worlds');need(isinstance(worlds,list) and 1<=len(worlds)<=12,'worlds: 1–12 миров');ids=set();keys={}
    for world in worlds:
        need(isinstance(world,dict) and isinstance(world.get('id'),str) and re.fullmatch(r'[a-z][a-z0-9-]{1,30}',world['id']) and world['id'] not in ids,'world.id: уникальный латиницей');ids.add(world['id'])
        string(world.get('title'),'world.title',80);string(world.get('description'),'world.description',400)
        need(world.get('type') in TYPES,'world.type: '+'/'.join(sorted(TYPES)));need(world.get('lang','py') in ('py','ru'),'world.lang: py/ru')
        if 'topicId' in world:need(world['topicId'] in topics,'world.topicId не входит в curriculum')
        levels=world.get('levels');need(isinstance(levels,list) and 3<=len(levels)<=10,'levels: 3–10 уровней в мире')
        for level in levels:
            need(isinstance(level,dict),'уровень должен быть объектом')
            for k in ('id','title','prompt','hint','explanation'):string(level.get(k),k)
            if 'clue' in level:string(level['clue'],'clue',300)
            if 'play' in level:need((level['play'],world['type']) in {('race','calc'),('race','binary'),('shooter','snake')},level['id']+': play — race для calc/binary или shooter для snake')
            need(re.fullmatch(r'[a-z][a-z0-9-]{1,40}',level['id']) and level['id'] not in ids,'level.id: уникальный латиницей: '+level['id']);ids.add(level['id'])
            key=[];validate_level(level,world,key);keys[level['id']]=key[0]
    return keys
