import {it,expect} from 'vitest';
import {makeZip} from '../src/lib/zip';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
it('exports a standard ZIP readable by an independent library, with Chinese filenames and binary contents',()=>{
 const path='/tmp/weavia-zip-regression.zip';writeFileSync(path,makeZip([{name:'商品主图.png',data:new Uint8Array([0,255,1,42])},{name:'作品清单.json',data:new TextEncoder().encode('{"ok":true}')} ]));
 const result=execFileSync('python3',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('商品主图.png')==bytes([0,255,1,42]); assert len(z.namelist())==2; print('ok')",path],{encoding:'utf8'});expect(result.trim()).toBe('ok');
});
