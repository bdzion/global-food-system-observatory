const {chromium}=require('/home/claude/gfso2/node_modules/playwright-core');const fs=require('fs');
const axe=fs.readFileSync('/home/claude/gfso2/node_modules/axe-core/axe.min.js','utf8');
const R=[['overview',''],['system','system'],['indicators','commodities'],['threats','watch'],['timelines','stress'],['briefs','briefs?geo=ETH&commodity=wheat'],['how','how']];
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
let tot=0,errs=[];
for(const [n,r] of R){ for(const vp of [[1680,900,'wide'],[1180,900,'desktop'],[360,740,'mobile']]){
  const p=await b.newPage({viewport:{width:vp[0],height:vp[1]}});
  p.on('pageerror',e=>errs.push(n+' THROW '+e.message.slice(0,90)));
  p.on('console',m=>{if(m.type()==='error')errs.push(n+' ERR '+m.text().slice(0,90));});
  await p.goto('http://localhost:4184/global-food-system-observatory/#/'+r,{waitUntil:'networkidle'});
  await p.waitForTimeout(1700);
  await p.addScriptTag({content:axe});
  const res=await p.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
  const over=await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-window.innerWidth));
  tot+=res.violations.length;
  const flag=res.violations.length?res.violations.map(v=>v.id+'('+v.nodes.length+')').join(','):'clean';
  console.log((n+'/'+vp[2]).padEnd(20),flag,over?('OVERFLOW '+over):'');
  await p.close();
}}
console.log('\nWCAG total:',tot,'| console errors:',errs.length?errs:'none');
await b.close();})();
