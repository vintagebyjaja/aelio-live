// A small safe Markdown renderer: React escapes all text; raw HTML is never evaluated.
function safeLink(value:string){
 if(value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\'))return value;
 try{const url=new URL(value);return ['http:','https:','mailto:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
function inline(text:string){
 const parts:any[]=[];const pattern=/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g;let index=0,match;
 while((match=pattern.exec(text))){parts.push(text.slice(index,match.index));const token=match[0];if(token.startsWith('`'))parts.push(<code key={match.index}>{token.slice(1,-1)}</code>);else if(token.startsWith('**'))parts.push(<strong key={match.index}>{token.slice(2,-2)}</strong>);else{const link=token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;const href=safeLink(link[2]||'');parts.push(href?<a key={match.index} href={href} target="_blank" rel="noreferrer">{link[1]||''}</a>:<span key={match.index}>{link[1]||''}</span>);}index=pattern.lastIndex;}
 parts.push(text.slice(index));return parts;
}
export function Markdown({text}:{text:string}){
 const lines=String(text||'').split('\n'),blocks:any[]=[];let index=0;
 while(index<lines.length){const line=lines[index]||'';if(line.startsWith('```')){const language=line.slice(3).trim().slice(0,30),code=[];index++;while(index<lines.length&&!(lines[index]||'').startsWith('```'))code.push(lines[index++]||'');if(index<lines.length)index++;blocks.push(<pre key={"code-"+index} aria-label={language?'Code: '+language:'Code block'}><code>{code.join('\n')}</code></pre>);continue;}
 if(!line.trim()){index++;continue;}
 const heading=line.match(/^(#{1,3})\s+(.+)$/);if(heading){blocks.push(<p className="markdown-heading" key={"heading-"+index}>{inline(heading[2]||'')}</p>);index++;continue;}
 if(/^\s*([-*]|\d+[.)])\s+/.test(line)){const ordered=/^\s*\d/.test(line),items=[];while(index<lines.length&&/^\s*([-*]|\d+[.)])\s+/.test(lines[index]||'')){items.push(<li key={index}>{inline((lines[index++]||'').replace(/^\s*([-*]|\d+[.)])\s+/,''))}</li>);}blocks.push(ordered?<ol key={"list-"+index}>{items}</ol>:<ul key={"list-"+index}>{items}</ul>);continue;}
 const paragraph=[line];index++;while(index<lines.length&&(lines[index]||'').trim()&&!/^(```|#{1,3}\s|\s*([-*]|\d+[.)])\s)/.test(lines[index]||''))paragraph.push(lines[index++]||'');blocks.push(<p key={"paragraph-"+index}>{inline(paragraph.join('\n'))}</p>);
 }
 return <div className="markdown-content">{blocks}</div>;
}
