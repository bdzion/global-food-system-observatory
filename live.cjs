const {chromium}=require('/home/claude/gfso2/node_modules/playwright-core');const fs=require('fs');
const axe=fs.readFileSync('/home/claude/gfso2/node_modules/axe-core/axe.min.js','utf8');
const B='https://bdzion.github.io/global-food-system-observatory/';
const R=[['system',''],['indicators','commodities'],['threats','watch'],['timelines','stress'],['briefs','briefs?geo=ETH&commodity=wheat'],['how','how']];
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
let tot=0,errs=[];
for(const [n,r] of R){
  const p=await b.newPage({viewport:{width:1180,height:900}});
  p.on('pageerror',e=>errs.push(n+' THROW '+e.message.slice(0,90)));
  p.on('console',m=>{if(m.type()==='error')errs.push(n+' ERR '+m.text().slice(0,90));});
  await p.goto(B+'#/'+r,{waitUntil:'networkidle',timeout:60000});
  await p.waitForTimeout(2600);
  await p.addScriptTag({content:axe});
  const res=await p.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
  const h=await p.evaluate(()=>document.body.scrollHeight);
  const rep=await p.evaluate(()=>document.querySelectorAll('.report-stream li').length);
  tot+=res.violations.length;
  console.log(n.padEnd(11),String(h).padStart(6)+'px','reports='+rep,res.violations.length?res.violations.map(v=>v.id).join(','):'a11y-clean');
  await p.close();
}
console.log('\nWCAG violations:',tot);
console.log('console errors:',errs.length?errs:'none');
await b.close();})();
