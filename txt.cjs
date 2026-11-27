const {chromium}=require('/home/claude/gfso2/node_modules/playwright-core');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1180,height:900}});
await p.goto('https://bdzion.github.io/global-food-system-observatory/#/',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(3000);
const t=await p.evaluate(()=>document.querySelector('.reader-guide').innerText);
fs.writeFileSync('/tmp/ov.txt',t);
console.log(t);
await b.close();})();
