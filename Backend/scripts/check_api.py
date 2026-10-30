#!/usr/bin/env python3
"""Run the 11-API contract against a running Tomcat (standard library only)."""
import http.cookiejar
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8081/enjoytrip').rstrip('/')
ORIGIN = '{0.scheme}://{0.netloc}'.format(urllib.parse.urlsplit(BASE))
checks = 0

class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def call(self, method, path, body=None, expected=200, headers=None, raw=None):
        global checks
        request_headers = {'Accept': 'application/json', 'X-Requested-With': 'EnjoyTrip', 'Origin': ORIGIN}
        if body is not None or raw is not None:
            request_headers['Content-Type'] = 'application/json'
        if headers:
            for key, value in headers.items():
                if value is None:
                    request_headers.pop(key, None)
                else:
                    request_headers[key] = value
        data = raw if raw is not None else (json.dumps(body, ensure_ascii=False).encode() if body is not None else None)
        request = urllib.request.Request(BASE + '/api' + path, data=data, headers=request_headers, method=method)
        try:
            response = self.opener.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        payload = response.read()
        assert response.status == expected, (method, path, response.status, expected, payload.decode())
        checks += 1
        if expected == 204:
            assert payload == b''
            return None
        assert 'application/json' in response.headers['Content-Type']
        decoded = json.loads(payload)
        if expected < 300:
            assert 'data' in decoded
            assert not any(field in payload.decode() for field in ['passwordHash', 'passwordSalt', 'passwordConfirm'])
            return decoded['data']
        assert 'code' in decoded['error'] and 'message' in decoded['error']
        return decoded['error']


def registration(account_email, **changes):
    return dict(name='한글여행자', email=account_email, password=' password123 ', passwordConfirm=' password123 ', terms=True) | changes


def credentials(email):
    return {'email': email, 'password': ' password123 '}


def post(title, **changes):
    return dict(category='review', title=title, content='한글 본문\n\n<script>window.shouldNotRun=true</script>') | changes


def main():
    owner, other, guest, second = Client(), Client(), Client(), Client()
    email = uuid.uuid4().hex + '@example.com'
    other_email = uuid.uuid4().hex + '@example.com'
    try:
        guest.call('GET', '/members/me', expected=401)
        for changes in [dict(name='가'), dict(email='invalid'), dict(password='short', passwordConfirm='short'), dict(passwordConfirm='different'), dict(terms=False), dict(terms=None), dict(role='ADMIN'), dict(terms='true')]:
            guest.call('POST', '/members/register', registration(email, **changes), expected=400)
        guest.call('POST', '/members/register', raw=b'{', expected=400)
        owner.call('POST', '/members/register', registration('  ' + email.upper() + '  '), expected=201)
        owner.call('GET', '/members/me', expected=401)  # signup does not log in
        guest.call('POST', '/members/register', registration(email), expected=409)
        guest.call('POST', '/auth/login', credentials(email) | {'password': 'password123'}, expected=401)
        user = owner.call('POST', '/auth/login', credentials(email))
        assert user['email'] == email
        session = next(iter(owner.cookies))
        assert session.has_nonstandard_attr('HttpOnly')
        assert session.get_nonstandard_attr('SameSite').lower() == 'lax'
        old_session_id = session.value
        owner.call('POST', '/auth/login', credentials(email))
        assert next(iter(owner.cookies)).value != old_session_id
        second.call('POST', '/auth/login', credentials(email))
        other.call('POST', '/members/register', registration(other_email), expected=201)
        other.call('POST', '/auth/login', credentials(other_email))
        owner.call('PUT', '/members/me', {'name': '수정여행자'})
        assert second.call('GET', '/members/me')['name'] == '수정여행자'
        owner.call('PUT', '/members/me', {'name': '정상이름', 'email': 'overwrite@example.com'}, expected=400)
        owner.call('POST', '/posts', post('CSRF'), expected=403, headers={'Origin': 'http://elsewhere.invalid'})
        owner.call('POST', '/posts', post('CSRF'), expected=403, headers={'X-Requested-With': None})
        guest.call('POST', '/posts', post('비회원'), expected=401)
        for invalid in [post(' '), post('a'*81), post('제목', content='b'*2001), post('제목', category='invalid'), post('제목', authorId='forged')]:
            owner.call('POST', '/posts', invalid, expected=400)
        token = uuid.uuid4().hex
        created = [owner.call('POST', '/posts', post(token + '-' + str(i)), expected=201) for i in range(8)]
        first, latest = created[0], created[-1]
        assert first['updatedAt'] is None and first['authorId'] == user['id'] and first['canEdit']
        detail = guest.call('GET', '/posts/' + first['id'])
        assert not detail['canEdit'] and '<script>' in detail['content']
        other.call('PUT', '/posts/' + first['id'], post('타인 수정'), expected=403)
        other.call('DELETE', '/posts/' + first['id'], expected=403)
        guest.call('GET', '/posts/missing', expected=404)
        first_page = guest.call('GET', '/posts?' + urllib.parse.urlencode({'type':'title','keyword':token,'page':1}))
        last_page = guest.call('GET', '/posts?' + urllib.parse.urlencode({'type':'title','keyword':token,'page':'999999999999999999999'}))
        assert first_page['totalItems'] == 8 and len(first_page['items']) == 7
        assert first_page['items'][0]['id'] == latest['id']
        assert last_page['page'] == 2 and len(last_page['items']) == 1
        assert guest.call('GET', '/posts?page=-1')['page'] == 1
        empty = guest.call('GET', '/posts?keyword=' + uuid.uuid4().hex)
        assert empty['items'] == [] and empty['totalPages'] == 1
        updated = owner.call('PUT', '/posts/' + first['id'], post('수정 후기'))
        assert updated['createdAt'] == first['createdAt'] and updated['updatedAt'] is not None
        assert updated['sequence'] == first['sequence']
        renamed = owner.call('PUT', '/members/me', {'name':'새이름'})
        assert guest.call('GET', '/posts/' + first['id'])['authorName'] == renamed['name']
        assert guest.call('GET','/posts?' + urllib.parse.urlencode({'type':'author','keyword':'새이름'}))['totalItems'] >= 8
        owner.call('DELETE','/posts/' + first['id'], expected=204)
        owner.call('DELETE','/posts/' + first['id'], expected=404)
        survivor = other.call('POST','/posts',post('타인 글 유지'),expected=201)
        owner.call('DELETE','/members/me',expected=204)
        second.call('GET','/members/me',expected=401)
        guest.call('GET','/posts/' + latest['id'],expected=404)
        assert guest.call('GET','/posts/' + survivor['id'])['id'] == survivor['id']
        other.call('POST','/auth/logout',expected=204)
        other.call('POST','/auth/logout',expected=204)
        other.call('GET','/members/me',expected=401)
        other.call('POST','/auth/login',credentials(other_email))
        other.call('DELETE','/members/me',expected=204)
        print(f'PASS: {checks} HTTP contract checks; all 11 APIs, UTF-8, sessions, ownership, search, validation and cascade deletion')
    finally:
        for client, account in [(owner,email),(other,other_email)]:
            try:
                client.call('POST','/auth/login',credentials(account))
                client.call('DELETE','/members/me',expected=204)
            except Exception:
                pass

if __name__ == '__main__':
    main()
