"""Private edge-to-engine messaging bridge. Uses the existing Intelligence Gateway.
The browser cannot call this route or supply its trusted payload headers.
"""
import base64
import hmac
import io
import json
import os
from starlette.responses import StreamingResponse
from .server import route, body, J, HTTPError, ensure_user
from . import identity
from .intelligence import gateway, context
from .intelligence.contracts import GenRequest, Message

@route('/api/internal/messaging', ('POST',))
async def respond(req):
    secret=os.environ.get('AELIO_MESSAGING_SECRET','')
    if not secret or not req.scope.get('aelio_proxied') or not hmac.compare_digest(req.headers.get('x-aelio-messaging-secret',''),secret):
        raise HTTPError(404,'not found')
    d=await body(req)
    if d.get('consent') is not True:
        raise HTTPError(403,'AI consent required','consent_required')
    caller={'user_id':None,'role':'guest'}
    if d.get('user_token'):
        n=identity.verify(d['user_token']); ident=identity.resolve(n); u=ensure_user(ident)
        if u.get('status') != 'active': raise HTTPError(403,'Account unavailable','suspended')
        caller={'user_id':u['id'],'role':u['role']}
        from . import db
        db.kv_set('messaging_bridge_seen',True)
        with db.tx() as c:
            c.execute('INSERT INTO user_settings(user_id,external_ai_consent_at,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET external_ai_consent_at=excluded.external_ai_consent_at,updated_at=excluded.updated_at',(u['id'],db.now(),db.now()))
    elif not d.get('guest'):
        raise HTTPError(401,'Guest identity required','guest_required')
    agents=d.get('agents',[])
    if not isinstance(agents,list) or not 1<=len(agents)<=4:
        raise HTTPError(400,'Choose one to four agents')
    attachments=[]
    for f in d.get('attachments',[])[:3]:
        data=base64.b64decode(f['base64'],validate=True)
        if len(data)>1000000: raise HTTPError(413,'Attachment too large')
        if f['mime']=='application/pdf':
            from pypdf import PdfReader
            content='\n'.join(page.extract_text() or '' for page in list(PdfReader(io.BytesIO(data)).pages)[:20])
        else: content=data.decode('utf-8',errors='replace')
        attachments.append({'name':str(f.get('name',''))[:180],'content':content[:12000]})
    def events():
        try:
            for agent in agents:
                kind=agent.get('kind','custom')
                if kind=='aelio':
                    name='AELIO'; system='You are AELIO, the permanent Original Main Pal. One Mind. Your Energy. Adapt naturally to tone, humor, seriousness and emotional context. Be truthful, coherent and willing to disagree. You have no fixed selectable personality.'
                elif kind=='mila':
                    name='MILA'; system="You are MILA, PATHD's distinct career and life companion. Be a warm, funny, supportive and appropriately direct homegirl, mentor and accountability partner. Listen first. No shaming or stereotypes. Support career, education, routines and balanced lives. You are not a licensed therapist or financial adviser. Do not claim a reminder or job search has run unless a confirmed tool result says so."
                else:
                    name=str(agent.get('name','Agent'))[:80]
                    system=f'You are {name}, a separate AELIO custom agent. Style: {agent.get("personality") or "Adaptive"}.'
                system+='\n'+context.POLICY+'\nThis conversation uses the AELIO Intelligence Gateway. Never claim to be AELIO Native unless the gateway reports that provider. No tools are available in this chat; never claim you saved a reminder or created a file.'
                data={'specialty':agent.get('specialty'),'instructions':agent.get('instructions'),'attachments':attachments}
                if d.get('memory_enabled') and agent.get('memory_enabled'):data['approved_memories']=agent.get('memories',[])
                if kind=='mila' or d.get('career'): data['authorized_career_context']=d.get('career',[])
                system+='\n<agent_profile>\n'+json.dumps(data,ensure_ascii=False)[:30000]+'\n</agent_profile>'
                history=[Message(role=m['role'],content=str(m['content'])[:8000]) for m in d.get('history',[])[-30:] if m.get('role') in ('user','assistant')]
                gen=GenRequest(user_id=caller['user_id'],purpose='chat',instructions=system,messages=history+[Message(role='user',content=str(d.get('content',''))[:8000])],conversation_id=d.get('conversation_id'))
                success=False
                for event in gateway.run(gen,caller):
                    yield json.dumps({**event,'agent_id':agent.get('id'),'speaker':name})+'\n'
                    if event['type']=='error':return
                    if event['type']=='done':success=True
                if not success:return
            yield json.dumps({'type':'complete'})+'\n'
        except gateway.GatewayRefused as e:
            yield json.dumps({'type':'error','code':e.code,'message':e.message})+'\n'
        except Exception:
            import logging
            logging.getLogger(__name__).exception('messaging_generation_failed')
            yield json.dumps({'type':'error','code':'brain_failure','message':'The Brain could not complete this response.'})+'\n'
    return StreamingResponse(events(),media_type='application/x-ndjson',headers={'Cache-Control':'no-store'})
