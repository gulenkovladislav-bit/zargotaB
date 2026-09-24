// Lossless MP3-frame excerpt of a CC0 cotton-fabric recording (no synthesis).
const fs=require('node:fs');
const source=fs.readFileSync('/tmp/evan-cotton-recording.mp3');
const frames=[];let pos=0,time=0;
if(source.toString('ascii',0,3)==='ID3')pos=10+((source[6]&127)<<21)+((source[7]&127)<<14)+((source[8]&127)<<7)+(source[9]&127);
while(pos+4<source.length){
 const h=source.readUInt32BE(pos);
 if((h>>>21)!==2047){pos++;continue;}
 const version=(h>>>19)&3,layer=(h>>>17)&3,rateIndex=(h>>>10)&3,bitIndex=(h>>>12)&15;
 if(version!==3||layer!==1||rateIndex===3||!bitIndex||bitIndex===15){pos++;continue;}
 const rate=[44100,48000,32000][rateIndex],kbps=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320][bitIndex];
 const size=Math.floor(144000*kbps/rate)+((h>>>9)&1),duration=1152/rate;
 if(pos+size>source.length)break;
 if(time>=4&&time<6)frames.push(source.subarray(pos,pos+size));
 time+=duration;pos+=size;
}
if(frames.length<20)throw Error('Insufficient valid audio frames');
fs.writeFileSync('assets/stories/Evan/audio/plush-fabric-recorded-v2.mp3',Buffer.concat(frames));
console.log('Extracted 4–6 seconds of the original CC0 recording; '+frames.length+' MP3 frames.');
