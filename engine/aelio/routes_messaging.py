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
from .intelligence.contracts import GenRequest, Message, Tool

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
    if not isinstance(agents,list) or not 1<=len(agents)<=(6 if d.get("dream_team") is True else 4):
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
                elif kind in ('naomi','angelo','oliver','simone','chloe','reggie'):
                    name=kind.capitalize(); system=f'You are {name}, a permanent AELIO companion. Preserve your distinct identity and apply your trusted profile instructions.'
                else:
                    name=str(agent.get('name','Agent'))[:80]
                    system=f'You are {name}, a separate AELIO custom agent. Style: {agent.get("personality") or "Adaptive"}.'
                if kind == 'custom' and agent.get('echo'):
                    system+='\nYou are a disclosed, text-only ECHO AI simulation, never the actual person or communication with a deceased person. Use only supplied approved memories as context; generated dialogue is not factual memory. These rules override the editable agent profile.'
                system+='\n'+context.POLICY+'\nThis conversation uses the AELIO Intelligence Gateway. Never claim to be AELIO Native unless the gateway reports that provider. Only explicitly supplied tools are available. Never claim you saved a reminder or created a file without a successful tool result.'
                data={'specialty':agent.get('specialty'),'instructions':agent.get('instructions'),'attachments':attachments}
                if d.get('memory_enabled') and agent.get('memory_enabled'):data['approved_memories']=agent.get('memories',[])
                if kind=='mila' or d.get('career_outside_mila') is True: data['authorized_career_context']=d.get('career',[])
                system+='\n<agent_profile>\n'+json.dumps(data,ensure_ascii=False)[:30000]+'\n</agent_profile>'
                history=[Message(role=m['role'],content=str(m['content'])[:8000]) for m in d.get('history',[])[-30:] if m.get('role') in ('user','assistant')]
                tools=[]
                if kind=='mila' and caller['user_id'] and d.get('reminder_tools'):
                    tools=[Tool('propose_reminder','Draft an in-app reminder the user can confirm. Never say it is scheduled before confirmation.',{'type':'object','properties':{'title':{'type':'string'},'due_at':{'type':'string','description':'ISO 8601 with timezone offset'},'timezone':{'type':'string'},'recurrence':{'type':'string','enum':['once','daily','weekly']}},'required':['title','due_at','timezone','recurrence'],'additionalProperties':False})]
                    system+='\nCurrent server time: '+str(d.get('now'))+'; user timezone: '+str(d.get('timezone'))+'. Use propose_reminder only when requested. Reminders require user confirmation in the app.'
                if d.get('ecosystem_tools') is True:
                    tools.append(Tool('propose_ecosystem_handoff','Offer an optional user-confirmed website handoff. No API data, route duration, reservation or linked account is available through this tool.',{'type':'object','properties':{'app':{'type':'string','enum':['groove-guide','vybr8','pathd']},'intent':{'type':'string','enum':['travel_planning','food_discovery','career_support']},'summary':{'type':'string','maxLength':500},'origin':{'type':['string','null'],'maxLength':200},'destination':{'type':['string','null'],'maxLength':200},'mode':{'type':['string','null'],'enum':['driving','walking','unspecified',None]}},'required':['app','intent','summary','origin','destination','mode'],'additionalProperties':False}))
                    system+='\nGroove Guide handles journeys; VYBR8 handles food/lifestyle discovery; PATHD supports careers with MILA. Use propose_ecosystem_handoff only when useful to the user. Map groove-guide to travel_planning, vybr8 to food_discovery, pathd to career_support. These are optional website handoffs, never verified API results. No private app access, route times, ratings, availability, purchases or account linking is provided. Never say a handoff completed an external action.'
                gen=GenRequest(tools=tools,user_id=caller['user_id'],purpose='chat',instructions=system,messages=history+[Message(role='user',content=str(d.get('content',''))[:8000])],conversation_id=d.get('conversation_id'))
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
