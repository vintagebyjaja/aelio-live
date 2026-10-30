// Consumer copy preserves page layouts while directing unsupported actions to real planning tools.
const ideas={
 '/technology/dream-code/':['Work through code, debugging and implementation ideas with AELIO.','Review and test code in your own development environment. Running code and managing a live project aren’t offered in this conversation.'],
 '/technology/dream-deploy/':['Prepare a thoughtful release plan, review checklist and rollout notes with AELIO.','Publishing happens in your chosen hosting tools. AELIO does not deploy your project from this page.'],
 '/technology/green-guardians/':['Explore AELIO’s research into thoughtful energy use and efficient computing.','This page describes our approach; it does not promise measured savings or automated changes to your devices.'],
 '/values/green-guardians/':['Thoughtful resource use is part of how we think about responsible technology.','AI-assisted suggestions are ideas to review, not verified energy savings.'],
 '/aelio/teammate/':['Work through your next project with AELIO. Turn a goal into clear tasks and review each step together.','Autonomous project execution isn’t available here. You stay in control of every action.'],
 '/aelio/conversation/':['Start a conversation in text, attach a supported document, or use voice input when your browser supports it.','Camera and screen analysis aren’t available in this conversation. Share a description or supported document instead.'],
 '/dream-beyond/dream-spaces/':['Give your ideas room to grow through focused conversations and shared plans.','Start with a conversation for each project.'],
 '/technology/dream-cloud/':['Your files and conversations deserve thoughtful care. Learn how AELIO approaches privacy and reliable access.','AELIO currently uses managed hosting and storage. Independent hosting is a longer-term direction.'],
 '/create/design/':['Bring a visual idea to AELIO and develop a clear creative brief together.','Use AELIO to prepare concepts and prompts; finished image rendering isn’t offered here.'],
 '/create/architecture/':['Explore a space, describe your requirements and build a design brief with AELIO.','Have a qualified professional review structural decisions. Drawing analysis and architectural renders aren’t offered here.'],
 '/create/animation/':['Develop your story, characters and a scene-by-scene animation brief with AELIO.','AELIO can help you plan the story; video rendering isn’t offered here.'],
 '/create/games/':['Shape a game idea, discuss mechanics and work through code with AELIO.','Building, running and publishing your game happens in your chosen development tools.'],
 '/create/worlds/':['Imagine a setting and develop its places, characters and stories with AELIO.','Use the conversation to develop your world; an interactive world editor isn’t offered here.'],
 '/create/projects/':['Organize a project through focused conversations, notes and downloadable text files.','Your files and conversations remain yours.'],
 '/live/marketplace/':['Shape a specialist agent for the way you like to work.','You can create and keep your own agents here. Buying and selling agents isn’t offered.'],
 '/live/publishing/':['Refine your agent’s purpose, style and instructions in your own space.','Keep and export an agent profile. Public listing and publishing aren’t offered here.'],
 '/agent-campus/lobby/':['Build a team of personal agents around the goals you care about.','Browse your own agents in your space; there is no public agent directory here.'],
 '/agent-campus/draft-block/':['Think through the skills your project needs and create a personal specialist.','Public agent recruiting isn’t offered here.'],
 '/agent-campus/university/':['Learn with AELIO through explanations, practice questions and useful feedback.','Conversation practice changes your understanding; it does not retrain the underlying model.'],
 '/agent-campus/mentor-mentee/':['Ask AELIO for a fresh perspective and a plan for practicing a skill.','You choose which advice to use.'],
 '/agent-campus/reports/':['Reflect on your goals and review your progress with AELIO.','AELIO can help organize your reflections; it does not certify an agent’s performance.'],
 '/agent-campus/accountability/':['Review important AI suggestions before acting, and keep your own decisions in view.','AI can make mistakes. Verify important information.'],
 '/agent-campus/community-service/':['Explore how technology can support your community with thoughtful planning.','Automated agent service and reinstatement aren’t offered here.'],
 '/agent-campus/onboarding/':['Create a personal agent with a clear purpose and the communication style you choose.','Your Original Main Pal remains AELIO.'],
 '/live/train-agents/':['Shape your personal agent with clear instructions and memories you choose.','These preferences don’t retrain the foundation model.'],
};
export function publicPage(page){
 const p={...page};
 if(ideas[p.path]){const [lede,note]=ideas[p.path];Object.assign(p,{lede,note,preview:undefined,what:[['Start with an idea','Describe what matters and what you want to achieve.'],['Think it through','Explore options in a focused conversation.'],['Make it yours','Review the advice and choose your next step.']],how:['Open your AELIO space.','Describe your goal and ask for a plan.','Review the result before acting.'],cta:['Explore with AELIO','/chat/']});}
 if(p.path==='/aelio/personalities/')Object.assign(p,{h1:['Your agents.','*Your energy.'],lede:'AELIO adapts naturally to you. Additional personal agents can have their own communication styles and specialties.',note:'Styles belong to your custom agents. Your Original Main Pal is always AELIO.',preview:undefined,how:['Open your space.','Create an agent and choose its style.','Keep its history and preferences separate.'],cta:['Open your space','/chat/']});
 if(p.path==='/aelio/main-pal/')Object.assign(p,{how:['Open your space.','Talk, plan or ask in your own words.','Choose what your agents keep in memory.'],note:'Current conversations use externally provided AI models through AELIO’s gateway. AELIO Native is separate research, not the model answering these chats.',cta:['Talk to AELIO','/chat/']});
 if(['/dream-beyond/agent-team/','/live/agent-teams/'].includes(p.path))Object.assign(p,{h1:['Different minds.','Different perspectives.','*Real conversations.'],lede:'Your people. Your conversations. Your kind of chaos. Bring different perspectives into one group chat.',how:['Create the agents you want.','Start a group conversation.','Choose a speaker or address the group.'],note:'Agent replies are conversation suggestions. They don’t take outside actions on your behalf.',cta:['Open your space','/chat/']});
 if(p.path==='/live/'||p.plans){p.lede='Start with your Free account. Talk, plan and create within your available allowance.';p.note='Free is the available plan today. No payment is required and checkout is closed.';if(p.how)p.how=['Create your account.','Explore your space.','Review your current allowance in Account.'];if(p.what)p.what=[['Free to enter','Your AELIO space starts without a payment.'],['Your allowance','See your available messages in Account.'],['Separate plans','Your PATHD subscription stays independent.']];}
 if(p.preview==='personas')p.preview=undefined;
 // Research descriptions remain truthful, without infrastructure troubleshooting or unfinished-product labels.
 for(const key of ['lede','note'])if(typeof p[key]==='string')p[key]=p[key].replace(/small prototypes/gi,'small research models').replace(/early prototypes/gi,'research models').replace(/prototype/gi,'research model').replace(/Public agent reports are planned\./g,'You can review goals in a conversation.');
 return p;
}
