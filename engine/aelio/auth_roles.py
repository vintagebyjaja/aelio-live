"""Server-controlled Supabase roles. Email alone never grants privileges."""
import os

def _set(name, lower=False):
    return {(s.strip().lower() if lower else s.strip()) for s in os.environ.get(name, '').split(',') if s.strip()}

def allowlist():
    return _set('AELIO_FOUNDER_EMAILS', True), _set('AELIO_FOUNDER_UIDS')

def _matches(claims, emails, uids):
    return bool(emails and uids and claims.get('sub') in uids and (claims.get('email') or '').lower() in emails)

def is_founder(claims):
    return claims.get('email_verified') is True and _matches(claims, *allowlist())

def portal_open():
    return os.environ.get('AELIO_PORTAL_OPEN','1').lower() in ('1','true','yes')

def identity(claims):
    founder=is_founder(claims)
    member=founder or portal_open() or _matches(claims,_set('AELIO_MEMBER_EMAILS',True),_set('AELIO_MEMBER_UIDS'))
    return {'uid':claims['sub'],'email':(claims.get('email') or '').lower(), 'role':'founder' if founder else 'member' if member else 'visitor',
            'unlimited':founder or _matches(claims,_set('AELIO_UNLIMITED_EMAILS',True),_set('AELIO_UNLIMITED_UIDS'))}
