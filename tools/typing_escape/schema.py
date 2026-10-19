"""Keyboard practice has its own validated text bank, without quiz missions."""
RU='абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
EN='abcdefghijklmnopqrstuvwxyz'
EXTRA=' 0123456789.,!?-:;'
def validate_typing(data):
    levels=data.get('typingLevels')
    if not isinstance(levels,list) or not 4<=len(levels)<=24:raise ValueError('typingLevels: от 4 до 24 этапов')
    ids=set()
    for level in levels:
        if not isinstance(level,dict):raise ValueError('Этап должен быть объектом')
        for key in ['id','title','hint','focus','story']:
            value=level.get(key)
            if not isinstance(value,str) or not 1<=len(value)<=300:raise ValueError('Неверное поле этапа '+key)
        if level['id'] in ids:raise ValueError('Повтор этапа')
        ids.add(level['id'])
        if type(level.get('scene')) is not int or not 0<=level['scene']<=3:raise ValueError('scene: 0–3')
        if type(level.get('chunks')) is not int or not 4<=level['chunks']<=14:raise ValueError('chunks: 4–14')
        for lang in ['ru','en']:
            chunks=level.get(lang)
            if not isinstance(chunks,list) or not level['chunks']<=len(chunks)<=24:raise ValueError('Неверный банк '+lang+': фраз должно быть не меньше chunks')
            alphabet=(RU+RU.upper() if lang=='ru' else EN+EN.upper())+EXTRA
            for s in chunks:
                if not isinstance(s,str) or not 2<=len(s)<=120 or any(c not in alphabet for c in s) or s!=s.strip() or '  ' in s:raise ValueError('Неверный текст '+lang+': '+repr(s))
