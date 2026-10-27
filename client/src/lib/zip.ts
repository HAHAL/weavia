export function makeZip(files:{name:string;data:Uint8Array}[]):Uint8Array{
 const encoder=new TextEncoder(),locals:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 const crc=(data:Uint8Array)=>{let c=0xffffffff;for(const b of data){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const file of files){const name=encoder.encode(file.name),sum=crc(file.data);const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,file.data.length,true);v.setUint32(22,file.data.length,true);v.setUint16(26,name.length,true);h.set(name,30);locals.push(h,file.data);
 const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,sum,true);d.setUint32(20,file.data.length,true);d.setUint32(24,file.data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+file.data.length;
 }
 const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
 const out=new Uint8Array(offset+size+22);let cursor=0;for(const part of [...locals,...central,end]){out.set(part,cursor);cursor+=part.length;}return out;
}
