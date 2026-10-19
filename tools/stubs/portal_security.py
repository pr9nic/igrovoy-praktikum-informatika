"""Заглушка модуля школьного журнала для тестов вне школьного сервера.

Настоящий portal_security лежит в /srv/school4/test-results-app и всегда стоит в sys.path раньше этой папки.
Учитель — запрос с адреса из TEACHER_IPS (по умолчанию пусто: все запросы ученические).
"""
from flask import request

TEACHER_IPS = frozenset()


def client_ip():
    return request.remote_addr or ''


def is_teacher():
    return client_ip() in TEACHER_IPS
