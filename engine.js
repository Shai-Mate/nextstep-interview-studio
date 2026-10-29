/* Local, deterministic practice builder. Job content is data, not instructions. */
(function(root){
'use strict';
const uid=()=>globalThis.crypto?.randomUUID?.()||`prep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function create(input){
 const job=String(input.job||'').trim().slice(0,60000);
 if(job.length<40)throw Error('Paste at least 40 characters from the actual job ad.');
 const requirements=job.split(/\n|(?<=[.!?])\s+/).map(s=>s.replace(/^\s*[-•*]\s*/, '').trim()).filter(s=>s.length>15).slice(0,8).map(s=>s.slice(0,300));
 if(!requirements.length)requirements.push(job.slice(0,300));
 const intake={experience:'Prefer not to say',stage:'Not sure yet',focus:'Balanced',time:'30 minutes',...input.intake};
 const role=String(input.role||'New opportunity').trim().slice(0,120),company=String(input.company||'Company').trim().slice(0,120);
 const req=requirements[0];
 const course=[
 {title:'Understand the opportunity',minutes:5,body:`Read the role: ${role} at ${company}. Separate explicit requirements from assumptions. Your ad says: “${req}”`,exercise:'Write one sentence explaining the role’s outcome. List two unknowns to ask the interviewer.',done:false},
 ...requirements.slice(0,3).map((r,i)=>({title:`Requirement ${i+1}: build your evidence`,minutes:5,body:`Job-ad evidence: “${r}”\nExplain what this would look like in practice. Prepare a true example, not an invented achievement. ${intake.experience==='Career change'?'Connect a transferable skill from a previous role, study or volunteer work.':'Choose an example appropriate to your own experience.'}`,exercise:`Draft a STAR story: Situation, Task, Action, Result. Tie your action directly to this requirement. ${intake.focus==='Role skills'?'Outline your method, tools, trade-offs and how you check the outcome.':'Explain your contribution and what you learned.'}`,done:false})),
 {title:`Prepare for ${intake.stage.toLowerCase()} conversation`,minutes:5,body:stageLesson(intake.stage),exercise:'Say a 60-second introduction aloud: what you do, a relevant example, and why this role. Use only real experience.',done:false},
 {title:'Ask questions and close well',minutes:5,body:`The ad does not prove what ${company} is like internally. Ask for examples rather than assuming a culture or process.`,exercise:'Prepare: What would success look like in the first 90 days? What is the hardest part of delivering this requirement? Finish with a concise statement of interest.',done:false}
 ];
 const questions=[`What interests you in ${role} at ${company}, and how does your background connect to “${req}”?`,...requirements.slice(0,3).map(r=>`Tell me about a real example relevant to “${r}”. What did you personally do, and what changed?`),stageQuestion(intake.stage,req),`What would you ask ${company} to clarify the priorities for ${role}?`];
 return {schema:1,id:uid(),company,role,job,url:String(input.url||'').slice(0,2000),intake,requirements,course,questions,notes:{},quiz:{answers:{}},mock:{index:0,answers:[],draft:'',finished:false},created:new Date().toISOString(),updated:new Date().toISOString()};
}
function stageLesson(s){return ({Technical:'Talk through a method, assumptions, failure cases and how you validate your work. It is fine to state what you do not know.',Panel:'Give concise examples with enough context for different functions. Address the person who asked, then include the panel.',Final:'Prepare to discuss priorities, expectations, motivation and mutual fit. Do not invent company facts.',Screening:'Prepare a short introduction, motivation, availability and questions about the process.'})[s]||'Prepare a short introduction, one evidence-based example and two questions. Ask what the next interview will assess.';}
function stageQuestion(s,r){return s==='Technical'?`Walk me through how you would approach “${r}”. What could go wrong and how would you test it?`:s==='Final'?`What would you prioritize in your first 90 days to address “${r}”, and what would you need to learn first?`:`Describe a time you had to adapt or learn quickly while working on something like “${r}”.`;}
root.PrepEngine={create};if(typeof module!=='undefined')module.exports=root.PrepEngine;
})(globalThis);
