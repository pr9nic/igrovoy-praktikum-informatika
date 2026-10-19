"""Validate declarative learning games. No executable code or remote assets."""
import math,collections
TYPES={'single','multi','number','sort','order','binary','robot','truth','pixel'}
def need(ok,msg):
    if not ok:raise ValueError('Игра: '+msg)
def string(x,label,limit=3000):need(isinstance(x,str) and 0<len(x.strip())<=limit,label+' — обязательный текст')
def strings(xs,label,lo,hi):
    need(isinstance(xs,list) and lo<=len(xs)<=hi,label+' — неверное число элементов')
    for x in xs:string(x,label)
def validate_game(data):
    strings(data.get('story'), 'story',1,5)
    missions=data.get('missions');need(isinstance(missions,list) and 4<=len(missions)<=20,'missions: 4–20 миссий');ids=set()
    for m in missions:
        need(isinstance(m,dict),'миссия должна быть объектом')
        for key in ['id','title','prompt','hint','explanation','topicId']:string(m.get(key),key)
        need(m['id'] not in ids,'повтор id');ids.add(m['id']);typ=m.get('type');need(typ in TYPES,'неизвестный type');ans=m.get('answer')
        if m.get('code') is not None:string(m['code'],'code')
        if m.get('table') is not None:
            need(isinstance(m['table'],list) and 2<=len(m['table'])<=12,'table: 2–12 строк')
            width=len(m['table'][0]);need(2<=width<=6,'table: 2–6 колонок')
            for row in m['table']:strings(row,'table',width,width)
        if typ in ['single','multi']:
            strings(m.get('options'),'options',2,6);need(len(set(m['options']))==len(m['options']),'варианты повторяются')
            indexes=[ans] if typ=='single' else ans
            need(isinstance(indexes,list) and indexes and all(type(i) is int and 0<=i<len(m['options']) for i in indexes) and len(set(indexes))==len(indexes),'неверные индексы answer')
        elif typ=='number':need(type(ans) in [int,float] and math.isfinite(ans),'answer — конечное число')
        elif typ=='sort':
            strings(m.get('groups'),'groups',2,5);strings(m.get('items'),'items',3,10)
            need(isinstance(ans,list) and len(ans)==len(m['items']) and all(type(i) is int and 0<=i<len(m['groups']) for i in ans),'неверное распределение answer')
        elif typ=='order':
            strings(m.get('items'),'items',3,8);need(isinstance(ans,list) and sorted(ans)==list(range(len(m['items']))) and all(type(i) is int for i in ans),'answer — перестановка индексов')
        elif typ=='binary':need(type(m.get('bits')) is int and 2<=m['bits']<=8 and type(ans) is int and 0<=ans<2**m['bits'],'неверный размер/значение двоичного пульта')
        elif typ=='truth':
            need(m.get('operation') in ['and','or','xor','not'],'operation: and/or/xor/not')
            pairs=[[0],[1]] if m['operation']=='not' else [[0,0],[0,1],[1,0],[1,1]]
            expected=[int(not a[0]) if m['operation']=='not' else int(all(a)) if m['operation']=='and' else int(any(a)) if m['operation']=='or' else int(a[0]!=a[1]) for a in pairs]
            need(ans==expected and all(type(x) is int for x in ans),'таблица истинности неверна')
        elif typ=='pixel':
            strings(ans,'pixel answer',3,8);width=len(ans[0]);need(3<=width<=8 and all(len(r)==width and set(r)<={'0','1'} for r in ans),'пиксельная карта — прямоугольник 0/1')
        elif typ=='robot':
            need(type(m.get('size')) is int and 3<=m['size']<=7,'size: 3–7')
            def valid_cell(c):return isinstance(c,list) and len(c)==2 and all(type(v) is int and 0<=v<m['size'] for v in c)
            need(valid_cell(m.get('start')) and valid_cell(m.get('goal')),'start/goal вне поля')
            walls=m.get('walls',[]);need(isinstance(walls,list) and all(valid_cell(c) for c in walls),'неверные стены');walls={tuple(c) for c in walls}
            need(tuple(m['start']) not in walls and tuple(m['goal']) not in walls and m['start']!=m['goal'],'неверные начало/цель')
            need(type(m.get('maxMoves')) is int and 1<=m['maxMoves']<=30,'maxMoves: 1–30')
            queue=collections.deque([(tuple(m['start']),0)]);seen=set();found=False
            while queue:
                c,n=queue.popleft()
                if c==tuple(m['goal']):found=True;break
                if c in seen or n>=m['maxMoves']:continue
                seen.add(c)
                for dx,dy in [(0,1),(0,-1),(1,0),(-1,0)]:
                    v=(c[0]+dx,c[1]+dy)
                    if valid_cell(list(v)) and v not in walls:queue.append((v,n+1))
            need(found,'робот не может дойти до цели за maxMoves')
