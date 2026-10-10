const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let animation,reduced=false,random=0;
function el(){return {style:{},children:[],append(...x){this.children.push(...x);},setAttribute(){},animate(frames,options){animation={frames,options,cancel(){this.cancelled=true;}};return animation;}};}
const w={matchMedia:()=>({matches:reduced})},math=Object.create(Math);math.random=()=>random;
vm.runInNewContext(fs.readFileSync('story-coins.js','utf8'),{window:w,document:{createElement:el},Math:math});
for(const metal of ['copper','silver','gold','platinum']){
 const file='images/ui/coins/'+metal+'-faces.png',png=fs.readFileSync(file);assert.equal(png.toString('ascii',1,4),'PNG');assert.equal(png[25],6,'RGBA');assert.equal(png.readUInt32BE(16),png.readUInt32BE(20)*2,'2:1 sheet');
 const v=w.ZargotaStoryCoins.viewer({itemId:'evan-'+metal+'-coin'}),coin=v.children[0].children[0],buttons=v.children[2].children;
 assert.equal(coin.children.length,2);assert.ok(coin.children[0].style.backgroundImage.includes(file));
 buttons[0].onclick();assert.equal(buttons[0].disabled,true);assert.equal(animation.options.duration,1100);assert.equal(animation.frames.at(-1).transform,'rotateY(180deg)');animation.onfinish();assert.equal(coin.style.transform,'rotateY(180deg)');
 random=0;buttons[1].onclick();assert.equal(animation.options.duration,2600);assert.match(animation.frames[3].transform,/translateY\(-32%\)/);assert.match(animation.frames.at(-1).transform,/translateY\(0%\).*rotateY\(2880deg\)/);animation.onfinish();assert.equal(coin.style.transform,'rotateY(0deg)');
 random=.9;buttons[1].onclick();animation.onfinish();assert.equal(coin.style.transform,'rotateY(180deg)');
 reduced=true;buttons[0].onclick();assert.equal(coin.style.transform,'rotateY(0deg)');assert.equal(buttons[0].disabled,false);reduced=false;
 buttons[1].onclick();v.dispose();assert.equal(animation.cancelled,true);
 const found=w.ZargotaStoryCoins.viewer({itemId:'evan-'+metal+'-coin'},{interactive:false});assert.equal(found.children.length,1,'pickup has art only, no actions or side label');found.dispose();
}
const traffic=fs.readFileSync('story-traffic.js','utf8');assert.match(traffic,/art\.style\.transform='scaleX/);assert.doesNotMatch(traffic,/art\.style\.transform='rotate/);
for(const metal of ['copper','silver','gold','platinum']){
 const file='images/ui/coins/'+metal+'-faces-uk.png',png=fs.readFileSync(file);assert.equal(png[25],6);assert.equal(png.readUInt32BE(16),png.readUInt32BE(20)*2);
 w.ZargotaI18n={getLocale:()=> 'uk'};const v=w.ZargotaStoryCoins.viewer({itemId:'evan-'+metal+'-coin'});assert.ok(v.children[0].children[0].children[0].style.backgroundImage.includes(file));v.dispose();
}
console.log('PASS four sheets, flip, toss outcomes, animation lock, reduced motion, disposal, upright carts.');
let sounds=[],allowed=true;
vm.runInNewContext(fs.readFileSync('story-coins.js','utf8'),{window:w,document:{createElement:el},Math:math,Audio:function(src){this.src=src;this.play=()=>{sounds.push(this);return Promise.resolve();};this.pause=()=>{this.paused=true;};}});
const audible=w.ZargotaStoryCoins.viewer({itemId:'evan-copper-coin'},{soundAllowed:()=>allowed}),actions=audible.children[2].children;
assert.equal(sounds.length,0);actions[0].onclick();assert.equal(sounds.length,1);assert.match(sounds[0].src,/yodguard-coin-collect-3-540190/);
actions[1].onclick();assert.equal(sounds.length,1);animation.onfinish();actions[1].onclick();assert.equal(sounds.length,2);assert.equal(sounds[0].paused,true);
animation.onfinish();allowed=false;actions[0].onclick();assert.equal(sounds.length,2);animation.onfinish();allowed=true;actions[1].onclick();assert.equal(sounds.length,3);audible.dispose();assert.equal(sounds[2].paused,true);assert.equal(sounds[2].src,'');actions[0].onclick();assert.equal(sounds.length,3);
console.log('PASS coin action sound, click lock, mute, previous audio cleanup and disposal');
